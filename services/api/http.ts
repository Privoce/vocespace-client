/** Standard Web API adapter shared by all backend handlers; no Next runtime. */
export class ApiRequest extends Request {
  get nextUrl() { return new URL(this.url); }
  get cookies() {
    return { get: (name: string) => {
      const value = this.headers.get('cookie')?.split(';').map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
      return value === undefined ? undefined : { value };
    } };
  }
}

export class ApiResponse extends Response {
  static json(value: unknown, init: ResponseInit = {}) {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    return new ApiResponse(JSON.stringify(value), { ...init, headers });
  }
  static redirect(url: string | URL, init: ResponseInit | number = 307) {
    const options = typeof init === 'number' ? { status: init } : init;
    const headers = new Headers(options.headers);
    headers.set('Location', String(url));
    return new ApiResponse(null, { ...options, status: options.status ?? 307, headers });
  }
}
