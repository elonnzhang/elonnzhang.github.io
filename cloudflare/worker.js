const EINK_HEADERS = ["x-eink", "eink", "prefer"];

function wantsEink(request) {
  return EINK_HEADERS.some((name) => {
    const value = request.headers.get(name);
    return value && /(?:^|[,;\s])(?:eink|1|true|yes)(?:$|[,;\s])/i.test(value);
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const pageRequest = request.method === "GET" || request.method === "HEAD";
    const hasEinkQuery = /(?:^|[?&])eink=(?:1|true|yes)(?:&|$)/i.test(url.search);

    if (pageRequest && wantsEink(request) && !hasEinkQuery) {
      url.searchParams.set("eink", "1");
      return Response.redirect(url.toString(), 302);
    }

    return fetch(request);
  },
};
