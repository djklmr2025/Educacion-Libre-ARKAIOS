export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.ARKAIOS_PUBLISH_GH_TOKEN || process.env.AGENT_GITHUB_PAT;
  const owner = process.env.ARKAIOS_PUBLISH_GH_OWNER || process.env.AGENT_GITHUB_ORG || 'arkaios-agents';
  const repo = process.env.ARKAIOS_PUBLISH_GH_REPO || 'ia-eduacion-libre-proyecto-arkaios-private';
  const branch = process.env.ARKAIOS_PUBLISH_BRANCH || 'main';

  if (!token) return res.status(500).json({ error: 'Missing publish token in server env' });

  const body = req.body || {};
  const filename = String(body.filename || '').trim();
  const pathInRepo = String(body.path || '').trim();
  const content = String(body.content || '');

  if (!filename || !content) {
    return res.status(400).json({ error: 'filename and content are required' });
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
  const finalPath = (pathInRepo || safeName).replace(/^\/+/, '');
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(finalPath)}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'ARKAIOS-Orquestador'
  };

  try {
    let currentSha = null;
    const getResp = await fetch(`${baseUrl}?ref=${encodeURIComponent(branch)}`, { headers });
    if (getResp.ok) {
      const getData = await getResp.json();
      currentSha = getData.sha || null;
    }

    const commitMessage = currentSha
      ? `chore(html+): update ${finalPath}`
      : `feat(html+): add ${finalPath}`;

    const putBody = {
      message: commitMessage,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch
    };
    if (currentSha) putBody.sha = currentSha;

    const putResp = await fetch(baseUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify(putBody)
    });

    const putData = await putResp.json();
    if (!putResp.ok) return res.status(putResp.status).json(putData);

    return res.status(200).json({
      ok: true,
      owner,
      repo,
      branch,
      path: finalPath,
      commit: putData.commit?.sha || null,
      fileUrl: putData.content?.html_url || null
    });
  } catch (error) {
    return res.status(500).json({ error: 'publish failed', details: error.message });
  }
}
