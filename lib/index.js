var _ = require('lodash')
var assert = require('assert')
var Boom = require('boom')
var BPromise = require('bluebird')
var os = require('os')
var pkg = require('../package.json')
var post = BPromise.promisify(require('wreck').post)
var url = require('url')
var util = require('util')

var SENTRY_AUTH = 'Sentry sentry_version=5, sentry_key=%s, sentry_secret=%s, sentry_client=' + pkg.name + '/' + pkg.version
var URI_TEMPLATE = '/api/%s/store/'

module.exports = Self

function Self(options) {
    var dsn = url.parse(options.dsn)
    var projectId = parseInt(dsn.pathname.match(/\/(.*)$/)[1])
    var key = dsn.auth.split(':')[0]
    var secret = dsn.auth.split(':')[1]
    this.uri = url.format({
        protocol: dsn.protocol,
        host: dsn.host,
        pathname: util.format(URI_TEMPLATE, projectId),
    })
    this.auth = util.format(SENTRY_AUTH, key, secret)
    this.hostname = os.hostname()
}

_.extend(Self.prototype, {

    _send: function (payload) {
        return post(this.uri, {
            headers: {
                'x-sentry-auth': this.auth,
            },
            payload: JSON.stringify(payload),
        }).then(function (res) {
            if (res[0].statusCode !== 200) throw Boom.create(res[0].statusCode, res[1])
            return JSON.parse(res[1])
        })
    },

    sendError: function (err, options, callback) {
        assert(err instanceof Error)
        if (_.isFunction(options)) {
            callback = options
            options = {}
        }
        return this._send({
            extra: _.extend({
                stacktrace: err.stack,
            }, options),
            level: 'error',
            message: err.message,
            server_name: this.hostname,
        }).nodeify(callback)
    },

    sendMessage: function (message, options, callback) {
        assert(_.isString(message))
        if (_.isFunction(options)) {
            callback = options
            options = {}
        }
        return this._send({
            extra: options,
            level: 'info',
            message: message,
            server_name: this.hostname,
        }).nodeify(callback)
    },

})

_.extend(Self, {

    create: function (options) {
        return new Self(options)
    },

})
