// Send-email function removed per revert request.
// This file is intentionally inert. The contact form uses Netlify Forms (static) instead.
exports.handler = async function () {
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Not Found' })
  };
};
