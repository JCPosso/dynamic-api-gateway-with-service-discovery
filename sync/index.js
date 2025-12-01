exports.handler = async (event) => {
  console.log('sync event', JSON.stringify(event));
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
