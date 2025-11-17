function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // Check if the URI is for a location or a post
    if (uri.startsWith('/locations/') ||  // trailing slash
        uri.startsWith('/posts') ||       // no trailing slash
        uri.startsWith('/tag/') ||        // trailing slash
        uri.startsWith('/author/')        // trailing slash
    ) {
        // Return a 301 redirect response
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: {
                'location': {
                    'value': '/archives'
                }
            }
        };
    }

    // If the URI does not match any redirect rules, return the original request unchanged
    return request;
}
