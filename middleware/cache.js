const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

module.exports = function cacheMiddleware(duration = CACHE_DURATION) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") return next();

    const key = req.originalUrl;
    const hit = cache.get(key);

    if (hit && Date.now() - hit.timestamp < duration) {
      res.setHeader("X-Cache", "HIT");
      res.setHeader(
        "Cache-Control",
        `public, max-age=${Math.floor(duration / 1000)}`,
      );
      return res.json(hit.data);
    }

    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode === 200) {
        cache.set(key, { data, timestamp: Date.now() });
        // Clean old entries
        if (cache.size > 200) {
          const oldest = [...cache.entries()]
            .sort((a, b) => a[1].timestamp - b[1].timestamp)
            .slice(0, 50)
            .map((e) => e[0]);
          oldest.forEach((k) => cache.delete(k));
        }
      }
      res.setHeader("X-Cache", "MISS");
      return originalJson(data);
    };

    next();
  };
};
