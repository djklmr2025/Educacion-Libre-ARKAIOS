import React from 'react';
import PlatformHub from './components/PlatformHub';
import { createRoot } from 'react-dom/client';

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(<PlatformHub />);
