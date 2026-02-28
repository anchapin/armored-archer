import * as fs from 'fs';
import * as path from 'path';

export function loadEnvironment(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const envFiles = [
    `.env.${nodeEnv}`,
    '.env',
    `.env.${nodeEnv}.local`
  ];

  for (const file of envFiles) {
    const envPath = path.join(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      
      for (const line of envContent.split('\n')) {
        const trimmedLine = line.trim();
        
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const equalsIndex = trimmedLine.indexOf('=');
          
          if (equalsIndex > 0) {
            const key = trimmedLine.substring(0, equalsIndex).trim();
            let value = trimmedLine.substring(equalsIndex + 1).trim();
            
            if (value.startsWith('"') && value.endsWith('"')) {
              value = value.slice(1, -1);
            } else if (value.startsWith("'") && value.endsWith("'")) {
              value = value.slice(1, -1);
            }
            
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      }
    }
  }
}

loadEnvironment();
