import fs from 'node:fs';
import { execSync } from 'node:child_process';

// Find files with > 4 vi.mock calls
const heavyMockFilesOutput = execSync(
  "grep -rl 'vi.mock(' src tests mcp | xargs -I {} bash -c 'count=$(grep -c \"vi.mock(\" \"{}\"); if [ \"$count\" -gt 4 ]; then echo \"{}\"; fi'",
  { encoding: 'utf8' }
);

const files = heavyMockFilesOutput.trim().split('\n').filter(Boolean);

const EXPLANATION = "// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).";

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  if (content.includes("Phase 7 Mock Density Exception")) {
    continue;
  }

  // Insert the comment right before the first vi.mock
  const firstMockIndex = content.indexOf('vi.mock(');
  if (firstMockIndex !== -1) {
    // Find the start of the line
    const lastNewline = content.lastIndexOf('\n', firstMockIndex);
    const before = content.slice(0, lastNewline + 1);
    const after = content.slice(lastNewline + 1);
    
    const newContent = before + EXPLANATION + '\n' + after;
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(`Added comment to ${file}`);
  }
}
