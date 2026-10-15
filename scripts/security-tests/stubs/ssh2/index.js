// Test stand-in for ssh2: never opens a connection. Each command a route would run on the mail server is recorded in
// globalThis.__sshCommands (with the host), so tests can check what would have been executed.
const { EventEmitter } = require('node:events');

class Client extends EventEmitter {
  connect(options) {
    this.host = options && options.host;
    setImmediate(() => this.emit('ready'));
    return this;
  }
  exec(cmd, callback) {
    (globalThis.__sshCommands ||= []).push({ host: this.host, cmd });
    const stream = new EventEmitter();
    stream.stderr = new EventEmitter();
    callback(null, stream);
    setImmediate(() => stream.emit('close', 0));
  }
  end() {}
}

module.exports = { Client };
