'use strict';

const http = require('http');
const Route = require('route-parser');
const _ = require('lodash');
const url = require('url');

class Server
{
	/**
	 * [constructor description]
	 * @param  {string} ip   server ip to bind to
	 * @param  {int} port server port
	 * @return {void}
	 */
	constructor( ip, port )
	{
		this.ip = ip || process.env.HTTP_HOST || 'localhost';
		this.port = port || process.env.HTTP_PORT || 1337;
		this.routes = [];
		this.middleware = [];
		this.endpoints = {};

		this.http = http.createServer((req, res) => {
			this.handleRequest( req, res );
		});

		this.http.listen(this.port, this.host, () => {
			console.log("HTTP listening on http://%s:%s", this.ip, this.port);
		});

		this.http.on('error', this.handleError);
	}

	handleError( error )
	{
		// top error handling
		console.log( error );
	}

	setRoutes( routes )
	{
		this.routes = routes;
	}

	/**
	 * Load routes with controllers
	 * @param  {object} routes Routes object
	 * @param  {string} dir    Path to load the class method from
	 * @return {void}
	 *
	 * @example
	 * let routes = {
	 * 		'/route': {
	 * 			'GET': 'Controller#method'
	 * 		}
	 * };
	 */
	loadRoutes( routes, dir )
	{
		let controllers = {};

		_.each(routes, ( route, uri ) => {
			_.each(route, ( action, method ) => {
				let data = action.split('#');
				controllers[ data[0] ] = controllers[ data[0] ] || new (require(dir + '/' + data[0]))();

				if ( _.isUndefined( controllers[ data[0] ][ data[1] ] ) )
					this[ method ]( uri, () => {
						return this.error(500, 'Server error');
					});
				else
					this[ method ]( uri, controllers[ data[0] ][ data[1] ] );
			});
		});
	}

	/**
	 * Set middleware to process before processing the route's action
	 * @param {string}   uri uri to match ( * for global, '/someroute' for specific route)
	 * @param {Function} fn  middleware function
	 * @return {void}
	 */
	setMiddleware( uri, fn )
	{
		this.middleware[ uri ] = this.middleware[ uri ] || [];
		this.middleware[ uri ].push( fn );
	}

	/**
	 * Set GET route
	 * @param {string}   route route to match
	 * @param {Function} fn    route method
	 */
	GET( route, fn )
	{
		this.routes.push({
			uri: new Route( route ),
			handler: fn,
			method: 'GET'
		});
	}

	/**
	 * Set POST route
	 * @param {string}   route route to match
	 * @param {Function} fn    route method
	 */
	POST( route, fn )
	{
		this.routes.push({
			uri: new Route( route ),
			handler: fn,
			method: 'POST'
		});
	}

	/**
	 * Set PUT route
	 * @param {string}   route route to match
	 * @param {Function} fn    route method
	 */
	PUT( route, fn )
	{
		this.routes.push({
			uri: new Route( route ),
			handler: fn,
			method: 'PUT'
		});
	}

	/**
	 * Set DELETE route
	 * @param {string}   route route to match
	 * @param {Function} fn    route method
	 */
	DELETE( route, fn )
	{
		this.routes.push({
			uri: new Route( route ),
			handler: fn,
			method: 'DELETE'
		});
	}

	/**
	 * Handles the incoming http request
	 * @param  {object} req Request object
	 * @param  {object} res Result object
	 * @return {void}
	 */
	handleRequest( req, res )
	{
		let found = false;
		let middlewares = [];

		_.each(this.routes, ( route ) => {
			let match = route.uri.match( req.url );
			if ( match && req.method === route.method )
			{
				let data = _.map(match, (m) => {  return m; });
				data.push( url.parse(req.url, true).query );

				found = true;

				if ( !_.isUndefined( this.middleware['*'] ) )
				{
					_.each(this.middleware['*'], ( fn ) => {
						middlewares.push( new Promise( fn ) );
					});
				}

				if ( !_.isUndefined( this.middleware[ req.url ] ) )
				{
					_.each(this.middleware[ req.uri ], ( fn ) => {
						middlewares.push( new Promise( fn ) );
					}, this);
				}

				if ( middlewares.length > 0 )
				{
					Promise.all(middlewares)
					.then(( ret ) => {
						this.resolveHandler(route, data.concat(ret), res);
					})
					.catch(( reason ) => {
						res.end(reason);
					});
				}
				else
					this.resolveHandler(route, data, res);

				return false;
			}
		}, this);

		if ( !found )
		{
			res.writeHead(404);
			res.end('Resource not found');
		}
	}

	/**
	 * Route method handler
	 * Called method can either return or return a promise
	 * @param  {string} route URI
	 * @param  {array} data  method arguments passed to function
	 * @param  {object} res   Result object
	 * @return {void}
	 */
	resolveHandler( route, data, res )
	{
		Promise.resolve(route.handler.apply(res, data))
		.then(( content ) => {
			if ( _.isObject( content ) )
			{
				if ( content.code )
					res.writeHead(content.code);
				else
					res.setHeader( 'content-type', content.type );

				res.end( content.data );
			}
			else
				res.end( content );
		});
	}

	/**
	 * JSON helper
	 * sets type and stringifies
	 * @param  {object|array} data data to stringify
	 * @return {object}
	 */
	json(data)
	{
		return {
			type: 'text/json',
			data: JSON.stringify( data )
		};
	}

	/**
	 * Error helper
	 * @param  {int} code    HTTP error code
	 * @param  {object|array} message message to stringify
	 * @return {object}
	 */
	error(code, message)
	{
		return {
			type: 'text/json',
			data: message,
			code: code
		};
	}
}

module.exports = Server;
