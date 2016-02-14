'use strict';

const http = require('http');
const Route = require('route-parser');
const _ = require('lodash');

class Server
{
	constructor( ip, port )
	{
		this.ip = ip;
		this.port = port;
		this.routes = [];

		this.http = http.createServer((req, res) => {
			this.handleRequest( req, res );
		});

		this.http.listen(this.port, () => {
			console.log("HTTP listening on http://%s:%s", this.ip, this.port);
		});

		this.http.on('error', this.handleError);
	}

	handleError( error )
	{
		console.log( error );
	}

	setRoutes( routes )
	{
		this.routes = routes;
	}

	GET( route, fn )
	{
		this.routes.push({
			uri: new Route( route ),
			handler: fn,
			method: 'GET'
		});
	}

	POST( route, fn )
	{
		//
	}

	PUT( route, fn )
	{
		//
	}

	DELETE( route, fn )
	{

	}

	handleRequest( req, res )
	{
		let found = false;

		_.each(this.routes, ( route ) => {
			let match = route.uri.match( req.url );
			if ( match )
			{
				found = true;

				let content = route.handler.apply(res, _.map(match, (m) => {  return m; }));

				if ( _.isObject( content ) )
				{
					res.setHeader( 'content-type', content.type );
					res.end( content.data );
				}
				else
					res.end( content );

				return false;
			}
		});

		if ( !found )
		{
			res.writeHead(404);
			res.end('Resource not found');
		}
	}

	json(data)
	{
		return {
			type: 'text/json',
			data: JSON.stringify( data )
		};
	}
}

module.exports.Server = Server;
