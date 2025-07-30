const https = require('https');
const querystring = require('querystring');

class SimpleBot {
  constructor(token) {
    this.token = token;
    this.offset = 0;
    this.handlers = {
      message: [],
      callback_query: []
    };
    this.textHandlers = [];
  }

  on(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event].push(handler);
    }
  }

  onText(regex, handler) {
    this.textHandlers.push({ regex, handler });
  }

  async sendMessage(chatId, text, options = {}) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        chat_id: chatId,
        text: text,
        ...options
      });

      const opts = {
        hostname: 'api.telegram.org',
        path: `/bot${this.token}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(opts, (res) => {
        let responseData = '';
        res.on('data', (chunk) => responseData += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(responseData);
            if (result.ok) {
              console.log('Message sent successfully');
              resolve(result.result);
            } else {
              reject(new Error(result.description));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  async editMessageText(text, options) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        text: text,
        ...options
      });

      const opts = {
        hostname: 'api.telegram.org',
        path: `/bot${this.token}/editMessageText`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(opts, (res) => {
        let responseData = '';
        res.on('data', (chunk) => responseData += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(responseData);
            if (result.ok) {
              resolve(result.result);
            } else {
              reject(new Error(result.description));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  async answerCallbackQuery(callbackQueryId, options = {}) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        callback_query_id: callbackQueryId,
        ...options
      });

      const opts = {
        hostname: 'api.telegram.org',
        path: `/bot${this.token}/answerCallbackQuery`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(opts, (res) => {
        let responseData = '';
        res.on('data', (chunk) => responseData += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(responseData);
            if (result.ok) {
              resolve(result.result);
            } else {
              reject(new Error(result.description));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  once(event, handler) {
    const wrappedHandler = (...args) => {
      handler(...args);
      const index = this.handlers[event].indexOf(wrappedHandler);
      if (index > -1) {
        this.handlers[event].splice(index, 1);
      }
    };
    this.on(event, wrappedHandler);
  }

  async deleteWebHook() {
    return new Promise((resolve) => {
      https.get(`https://api.telegram.org/bot${this.token}/deleteWebhook`, (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve());
      });
    });
  }

  async getMe() {
    return new Promise((resolve, reject) => {
      https.get(`https://api.telegram.org/bot${this.token}/getMe`, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.ok) {
              resolve(result.result);
            } else {
              reject(new Error(result.description));
            }
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  startPolling() {
    console.log('Starting polling...');
    this.polling = true;
    this.poll();
  }

  poll() {
    if (!this.polling) return;

    https.get(`https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.offset}&timeout=30`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.ok && response.result.length > 0) {
            response.result.forEach(update => {
              this.offset = update.update_id + 1;
              
              if (update.message) {
                console.log(`[${new Date().toISOString()}] Message from ${update.message.from.username || update.message.from.id}: ${update.message.text}`);
                
                // Обработка текстовых команд
                let handled = false;
                if (update.message.text) {
                  for (const { regex, handler } of this.textHandlers) {
                    if (regex.test(update.message.text)) {
                      handler(update.message);
                      handled = true;
                      break;
                    }
                  }
                }
                
                // Обработка всех сообщений (только если не была обработана как команда)
                if (!handled || !update.message.text?.startsWith('/')) {
                  this.handlers.message.forEach(handler => handler(update.message));
                }
              }
              
              if (update.callback_query) {
                console.log(`[${new Date().toISOString()}] Callback query: ${update.callback_query.data}`);
                this.handlers.callback_query.forEach(handler => handler(update.callback_query));
              }
            });
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
        
        // Следующий запрос
        setTimeout(() => this.poll(), 100);
      });
    }).on('error', (error) => {
      console.error('Request error:', error);
      setTimeout(() => this.poll(), 5000);
    });
  }
}

module.exports = SimpleBot;