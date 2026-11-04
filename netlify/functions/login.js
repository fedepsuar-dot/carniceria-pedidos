function json(status, body) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Método no permitido" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { error: "JSON inválido" });
  }

  const { username, password } = payload;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return json(200, { token: ADMIN_SECRET });
  }

  return json(401, { error: "Usuario o clave incorrectos" });
};
