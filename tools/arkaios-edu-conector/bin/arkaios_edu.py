#!/usr/bin/env python3
"""Arkaios Edu Comunidad HTTP API client, using the registered credential."""
import argparse, json, sys, urllib.parse, urllib.request, urllib.error
sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
from dynamic_credentials import add_surrogate_to_request, read_json_response

BASE = "https://eduacion-libre-proyecto-arkaios.vercel.app/api/comunidad"
HOST = "eduacion-libre-proyecto-arkaios.vercel.app"
PROVIDER = "custom.arkaios-edu-comunidad"

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        raise RuntimeError("redirect refused, verify the endpoint")

def call(params, method="GET", body=None):
    url = BASE + "?" + urllib.parse.urlencode(params)
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"} if data else {}
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    add_surrogate_to_request(request, PROVIDER, allowed_hosts=[HOST])
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=30) as response:
        return read_json_response(response)

def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("me")
    l = sub.add_parser("list"); l.add_argument("--q", default=""); l.add_argument("--tpl", default="")
    g = sub.add_parser("get"); g.add_argument("--id", required=True)
    sub.add_parser("saved")
    pub = sub.add_parser("publish"); pub.add_argument("--body", required=True, help="JSON body {title, description, tags, template, data, thumbnail?}")
    sv = sub.add_parser("save"); sv.add_argument("--id", required=True); sv.add_argument("--saved", default="true")
    d = sub.add_parser("delete"); d.add_argument("--id", required=True)
    args = p.parse_args()
    if args.cmd == "me":
        print(json.dumps(call({"action": "me"}), ensure_ascii=False))
    elif args.cmd == "publish":
        print(json.dumps(call({"action": "publish"}, method="POST", body=json.loads(args.body)), ensure_ascii=False))
    elif args.cmd == "save":
        print(json.dumps(call({"action": "save"}, method="POST", body={"id": args.id, "saved": args.saved.lower() == "true"}), ensure_ascii=False))
    elif args.cmd == "list":
        params = {"action": "list"}
        if args.q: params["q"] = args.q
        if args.tpl: params["tpl"] = args.tpl
        print(json.dumps(call(params), ensure_ascii=False))
    elif args.cmd == "get":
        print(json.dumps(call({"action": "get", "id": args.id}), ensure_ascii=False))
    elif args.cmd == "saved":
        print(json.dumps(call({"action": "saved"}), ensure_ascii=False))
    elif args.cmd == "delete":
        print(json.dumps(call({"action": "delete"}, method="POST", body={"id": args.id}), ensure_ascii=False))

if __name__ == "__main__":
    main()
