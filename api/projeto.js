/**
 * ============================================================================
 * LEGADO DESATIVADO — /api/projeto
 * Endpoint legado removido. Todas as requisicoes recebem 410 Gone.
 * ============================================================================
 */

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(410).send(JSON.stringify({
    erro: 'Endpoint legado desativado',
    mensagem: 'Esta funcao serverless foi removida. Use as rotas em src/app/api/.'
  }));
};
