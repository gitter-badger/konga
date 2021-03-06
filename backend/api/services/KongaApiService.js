'use strict';

var unirest = require("unirest")
var async= require('async')


var KongaApiService = {

    consumers : {
        create: function (inc, cb) {

            var consumer = {}
            unirest.post(sails.config.kong_admin_url + '/consumers')
                .send({
                    username  : inc.username,
                    custom_id : inc.custom_id
                })
                .end(function (response) {
                    if (response.error)  {
                        if(response.body) {
                            response.body.path = "consumer"
                            response.body.obj = {
                                username  : inc.username,
                                custom_id : inc.custom_id
                            }
                        }

                        return cb(response)
                    }

                    consumer = response.body

                    KongaApiService
                        .consumers
                        .addAcls(consumer.id,inc.acls,function(err,result){
                            if(err) {
                                // Try to delete the created consumer in case of error
                                KongaApiService
                                    .consumers
                                    .delete(consumer.id,function(error,ok){})
                                return cb(err)
                            }
                            consumer.acls = result

                            KongaApiService
                                .consumers
                                .addAuthorizations(consumer.id,inc.authorizations,function(err,auths){
                                    if(err) {
                                        // Try to delete the created consumer in case of error
                                        KongaApiService
                                            .consumers
                                            .delete(consumer.id,function(error,ok){})
                                        return cb(err)
                                    }
                                    consumer.autorizations = auths
                                    return cb(null,consumer)
                                })
                        })
                })
        },

        delete : function(consumer_id,cb) {
            unirest.delete(sails.config.kong_admin_url + '/consumers/' + consumer_id)
                .end(function (response) {
                    if (response.error) return cb(response)
                    return cb(null,response.body)
                })
        },

        addAcls: function (consumer_id,acls, cb) {
            if(!acls || !acls.length) return cb(null,{})

            var promises = []

            acls.forEach(function(acl) {
                promises.push(function (callback) {
                    unirest.post(sails.config.kong_admin_url + '/consumers/' + consumer_id + "/acls")
                        .send({
                            group : acl
                        })
                        .end(function(response){
                            if(response.error) {
                                if(response.body) {
                                    response.body.path = "acls"
                                    response.body.obj = acl
                                }

                                return callback(response);
                            }
                            return callback(null,response.body)
                        })
                })
            })

            async.series(promises, function(err,result) {
                if (err) return cb(err)
                return cb(null,result)
            });


        },

        addAuthorizations: function (consumer_id,authorizations, cb) {
            if(!authorizations || !authorizations.length) return cb(null,{})
            var promises = []
            var _authorizations = {}

            authorizations.forEach(function(auth) {
                promises.push(function (callback) {
                    unirest.post(sails.config.kong_admin_url + '/consumers/' + consumer_id + "/" + auth.name)
                        .send(auth.config || {})
                        .end(function (response) {

                            if (response.error) {
                                if(response.body) {
                                    response.body.path = "authorizations"
                                    response.body.obj = auth
                                }

                                return callback(response)
                            }

                            if(!_authorizations[auth.name]) _authorizations[auth.name] = []
                            _authorizations[auth.name].push(response.body)

                            return callback(null, response.body)
                        })
                })
            })

            async.series(promises, function(err,result) {
                if (err) return cb(err)
                return cb(null,_authorizations)
            });


        },  
    },

    apis : {
        register : function(api,cb) {

            var result = {}
            var plugins = []
            if(api.plugins) {
                plugins = api.plugins
                delete api.plugins
            }

            KongaApiService.apis.updateOrAddApi(api,function(err,_api) {

                if (err)  return cb(err)

                result = _api

                KongaApiService.apis
                    .updateOrAddPlugins(result.name,plugins,function(err,_plugins){
                        if (err)  {
                            KongaApiService.apis.deleteApi(result.id,function(err,deleted){})
                            return cb(err)
                        }
                        result.plugins = _plugins
                        return cb(null,result)

                    })
            })
        },
        updateOrAddApi : function(api,cb) {

            unirest.put(sails.config.kong_admin_url + "/apis")
                .send(api)
                .end(function (response) {
                    if (response.error)  {
                        if(response.body) {
                            response.body.path = "api"
                            response.body.obj = api
                        }

                        return cb(response)
                    }

                    return cb(null,response.body)
                })
        },

        deleteApi : function(api_id,cb) {
            unirest.delete(sails.config.kong_admin_url + "/apis/" + api_id)
                .end(function (response) {
                    if (response.error)  return cb(response)
                    return cb(null,true)
                })
        },

        updateOrAddPlugins : function(api,plugins,cb) {
            if(!plugins || !plugins.length) return cb(null,{})
            var promises = []

            plugins.forEach(function(plugin) {
                promises.push(function (callback) {


                    unirest.put(sails.config.kong_admin_url + '/apis/' + api + "/plugins")
                        .send(plugin)
                        .end(function (response) {

                            if (response.error) {
                                if(response.body) {
                                    response.body.path = "plugins"
                                    response.body.obj = plugin
                                }

                                return callback(response)
                            }

                            return callback(null, response.body)
                        })
                })
            })

            async.series(promises, function(err,result) {
                if (err) return cb(err)
                return cb(null,result)
            });
        }
    }

}

module.exports = KongaApiService
