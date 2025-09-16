function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // Check if the URI is for a location or a post
    if (uri.startsWith('/locations/') ||  // trailing slash
        uri.startsWith('/posts') ||       // no trailing slash
        uri.startsWith('/tag/') ||        // trailing slash
        uri.startsWith('/author/')        // trailing slash
    ) {
        // Construct the new URL using the new domain and the original path
        var newUrl = 'https://backblasts.f3rva.org' + uri;
        
        // Return a 301 redirect response
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: {
                'location': {
                    'value': newUrl
                }
            }
        };
    }

    // Redirect individual WordPress posts that follow the /YYYY/ format
    var postRegex = /^\/\d{4}\//;
    if (postRegex.test(uri)) {
        var newUrl = 'https://backblasts.f3rva.org' + uri;
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: {
                'location': {
                    'value': newUrl
                }
            }
        };
    }

    // Redirect www.<host> to the naked host, preserving path and querystring
    var hostHeader = request.headers && request.headers.host && request.headers.host.value;
    if (hostHeader && /^www\./i.test(hostHeader)) {
        var nakedHost = hostHeader.replace(/^www\./i, '');
        var qs = request.querystring ? ('?' + request.querystring) : '';
        var newUrl = 'https://' + nakedHost + uri + qs;
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: {
                'location': {
                    'value': newUrl
                }
            }
        };
    }

    // If the URI does not match any redirect rules, return the original request unchanged
    return request;
}
