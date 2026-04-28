import fs from 'node:fs';
import { execSync } from 'node:child_process';

const mockModulesToRemove = [
  '"@/lib/auth"',
  "'@/lib/auth'",
  '"@/lib/db"',
  "'@/lib/db'",
  '"@/lib/observability/logger"',
  "'@/lib/observability/logger'",
  '"next/navigation"',
  "'next/navigation'",
  '"@/lib/chat/conversation-root"',
  "'@/lib/chat/conversation-root'",
];

function removeMocksFromFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  for (const moduleName of mockModulesToRemove) {
    const searchStr = `vi.mock(${moduleName}`;
    
    let index = content.indexOf(searchStr);
    while (index !== -1) {
      // Find the start of the vi.mock
      let startIndex = index;
      
      // We need to find the matching closing parenthesis for `vi.mock(`
      // The open paren is at index + 'vi.mock'.length
      let openParenIndex = content.indexOf('(', index);
      if (openParenIndex === -1) break;
      
      let balance = 0;
      let endIndex = -1;
      let inString = false;
      let stringChar = '';
      
      for (let i = openParenIndex; i < content.length; i++) {
        const char = content[i];
        
        if (inString) {
          if (char === stringChar && content[i-1] !== '\\') {
            inString = false;
          }
        } else {
          if (char === '"' || char === "'" || char === '\`') {
            inString = true;
            stringChar = char;
          } else if (char === '(') {
            balance++;
          } else if (char === ')') {
            balance--;
            if (balance === 0) {
              endIndex = i;
              break;
            }
          }
        }
      }
      
      if (endIndex !== -1) {
        // Find if there's a semicolon after
        let maybeSemicolon = content.indexOf(';', endIndex);
        // Only consume the semicolon if there's only whitespace between
        let between = content.slice(endIndex + 1, maybeSemicolon);
        if (between.trim() === '') {
          endIndex = maybeSemicolon;
        }
        
        // Remove from startIndex to endIndex
        const before = content.slice(0, startIndex);
        const after = content.slice(endIndex + 1);
        
        content = before + after;
      }
      
      // Look for next occurrence
      index = content.indexOf(searchStr, startIndex); // the text shifted, so searching from startIndex is fine
    }
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

// Find all test files
const testFiles = execSync("grep -rl 'vi.mock(' src tests mcp || true", { encoding: 'utf8' }).trim().split('\n').filter(Boolean);

for (const file of testFiles) {
  removeMocksFromFile(file);
}
