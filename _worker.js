// _worker.js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // تنظیمات امنیتی
    const response = await fetch(request);
    const newResponse = new Response(response.body, response);
    
    newResponse.headers.set('X-Content-Type-Options', 'nosniff');
    newResponse.headers.set('X-Frame-Options', 'DENY');
    newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    return newResponse;
  }
};
