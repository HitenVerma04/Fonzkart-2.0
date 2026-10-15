import { Client } from 'ssh2';

// Runs one command on the mail server over SSH. Only called with commands built by lib/mail-admin.ts
// (mailserverCommand: validated mailbox, base64 password) and only when MAILSERVER_SSH_HOST is set.
export async function execSSH(host: string, cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.exec(cmd, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        let out = '';
        stream.on('close', () => {
          conn.end();
          resolve(out);
        }).on('data', (data: any) => {
          out += data;
        }).stderr.on('data', (data: any) => {
          out += data;
        });
      });
    }).on('error', (err) => {
      reject(err);
    }).connect({
      host,
      port: 22,
      username: process.env.MAILSERVER_SSH_USER || 'root',
      password: process.env.SSH_PASSWORD || process.env.SMTP_PASSWORD || ''
    });
  });
}
