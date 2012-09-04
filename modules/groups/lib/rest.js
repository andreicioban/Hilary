var groupApi = require('./api.js');

module.exports = function(tenant) {

    tenant.server.get('/groups/create', function(req, res) {
        console.log("create");
        groupApi.createGroup(tenant, req.query.name, req.query.description, function(err, id) {
            if (err) {
                console.log(err.msg);
                res.send(err.code, err.msg);
            }
            else {
                res.send(201, {'id': id});   
            }
        });
    });

    tenant.server.get('/groups/:id', function(req, res) {
        groupApi.getGroup(tenant, req.params.id, function(err, group) {
            if (err) {
                res.send(err.code, err.msg);
            }
            else {
                res.send(group);
            }
        });
    });

    tenant.server.get('/groups/:id/members', function(req, res) {
        groupApi.getGroupMembers(tenant, req.params.id, true, function(err, members) {
            if (err) {
                res.send(err.code, err.msg);
            }
            else {
                res.send(members);
            }
        });
    });

    tenant.server.get('/groups/:id/users', function(req, res) {
        groupApi.getGroupUsers(tenant, req.params.id, function(err, members) {
            if (err) {
                res.send(err.code, err.msg);
            }
            else {
                res.send(members);
            }
        });
    });

    tenant.server.get('/groups/:id/add', function(req, res) {
        if (!req.query.principals) {
            res.send(400, "No principals were specified.");
        }
        else {
            groupApi.addGroupMembers(tenant, req.params.id, req.query.principals, function(err, members) {
                if (err) {
                    console.log(err.msg);
                    res.send(err.code, err.msg);
                }
                else {
                    res.send(200);
                }
            });
        }
    });

    tenant.server.get('/groups/:id/delete', function(req, res) {
        if (!req.query.principals) {
            res.send(400, "No principals were specified.");
        }
        else {
            groupApi.addGroupMembers(tenant, req.params.id, req.query.principals, function(err, members) {
                if (err) {
                    console.log(err.msg);
                    res.send(err.code, err.msg);
                }
                else {
                    res.send(200);
                }
            });
        }
    });
}