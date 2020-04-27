const path = require('path');
const EmailTemplates = require('email-templates');

const render = (templateName, locals) => {
  const template = new EmailTemplates();
  const targetTemplate = !templateName.includes('/')
    ? `${templateName}/html`
    : templateName;

  const file = path.join(__dirname, targetTemplate);
  return template.render(file, {
    soundwiseBranding: true,
    year: new Date().getFullYear(),
    ...locals,
  });
};

module.exports = {
  render,
};
