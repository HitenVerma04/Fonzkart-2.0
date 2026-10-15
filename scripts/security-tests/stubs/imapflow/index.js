// Test stand-in for imapflow: the tests never read a real mailbox.
class ImapFlow {
  async connect() { throw new Error('IMAP is not available in tests'); }
}
module.exports = { ImapFlow };
