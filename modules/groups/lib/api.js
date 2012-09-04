var OAE = require('../../../util/OAE');
var groupModel = require('./model.js');

/**
 * Get the metadata for a group.
 * @param  {String}   group_id An identifier for a group. ex: g:cam:oae-team
 * @param  {Function} callback Standard callback method.
 */
module.exports.getGroup = function(group_id, callback) {
    if (group_id.slice(0, 2) !== "g:") {
        callback("The provided group_id is not a group identifier.", null);
        return;
    }

    OAE.runQuery('SELECT * FROM Principals WHERE principal_id = ?', [group_id], function (err, rows) {
        if (err) {
            callback({'code': 500, 'msg': err}, null);
        } else {
            if (rows[0]._colCount == 1) {
                callback({'code': 404, 'msg': "Couldn't find that group."}, null);
            }
            else {
                // TODO: Check profile privacy.
                if (rows[0].colHash.privacy_setting && rows[0].colHash.privacy_setting === 'private') {
                    callback({'code': 404, 'msg': "Couldn't find that group."}, null);
                }
                else {
                    var group = groupModel.rowToGroup(rows[0]);
                    callback(false, group);
                }
            }
        }
    });
};

/**
 * Get all the members of a group.
 * 
 * @param  {String}   group_id An identifier for a group. ex: g:cam-oae-team
 * @param  {Boolean}  retrieve_metadata Wether or not the metadata information should be included for the principals
 * @param  {Function} callback Standard callback method
 */
module.exports.getGroupMembers = function(group_id, retrieve_metadata, callback) {
    OAE.runQuery('SELECT * FROM GroupMembers WHERE group_id = ?', [group_id], function (err, rows) {
        if (err) {
            callback({'code': 500, 'msg': err}, null);
        } else {
            var members = [];
            for (var i = 0, j = rows[0].cols.length;i<j;i++) {
                if (rows[0].cols[i].name !== "group_id") {
                    members.push(rows[0].cols[i].name);
                }
            }
            if (members.length === 0) {
                console.warn("Group '%s' has no members.", group_id);
                return callback(false, members);
            }

            if (!retrieve_metadata) {
                return callback(false, members);
            }
            else {
                getMetaData(members, callback);
            }
        }
    });
};

module.exports.memberOf = function(principal_id, retrieve_metadata, callback) {
     OAE.runQuery('SELECT * FROM MemberOf WHERE principal_id = ?', [principal_id], function (err, rows) {
        if (err) {
            callback({'code': 500, 'msg': err}, null);
        } else {
            var members = [];
            for (var i = 0, j = rows[0].cols.length;i<j;i++) {
                if (rows[0].cols[i].name !== "principal_id") {
                    members.push(rows[0].cols[i].name);
                }
            }
            if (members.length === 0) {
                console.warn("Principal '%s' is not a member of any group.", principal_id);
                return callback(false, members);
            }

            if (!retrieve_metadata) {
                return callback(false, members);
            }
            else {
                getMetaData(members, callback);
            }
        }
    });
}

/**
 * Adds a principal to a group.
 * @param {String}   group_id        The identifier of a group. ex: g:cam:oae-team
 * @param {String[]}   principalsToAdd An array of principal identifiers you wish to add. ex: [g:cam:ui-team, g:cam:backend-team]
 * @param {Function} callback        Standard callback function.
 */
module.exports.addGroupMembers = function(group_id, principalsToAdd, callback) {
    // If we only add in one principal.
    if (typeof principalsToAdd === "string") {
        principalsToAdd = [principalsToAdd];
    }

    // Check the prefixes of each member we wish to add.
    var proceed = true;
    for (var i = 0; i < principalsToAdd.length;i++) {
        if ( (principalsToAdd[i].slice(0, 2) !== "g:" && principalsToAdd[i].slice(0, 2) !== "u:") || (principalsToAdd[i] === group_id)) {
            proceed = false;
            break;
        }
    }

    if (!proceed) {
        callback({'code': 400, 'msg': "You can only add users and/or groups and not the group itself."}, null);
        return;
    }

    // Verify that the provided principals actually exist in the database.
    OAE.runQuery('SELECT * FROM Principals WHERE principal_id IN (?)', [principalsToAdd], function (err, rows) {
        if (err) {
            callback({'code': 500, 'msg': err}, null);
        } else {
            // Convert principalsToAdd to hash to create faster lookup.
            var requestPrincipals = {};
            for (var i = 0; i < principalsToAdd.length;i++) {
                requestPrincipals[principalsToAdd[i]] = true;
            }

            var all_valid = true;
            for (var i = 0; i < rows.rowCount();i++) {
                if (rows[i]._colCount === 1) {
                    // This is an invalid principal!
                    requestPrincipals[rows[i].colHash.principal_id] = false;
                    all_valid = false;
                }
            }
            
            if (!all_valid) {
                callback({'code': 400, 'msg': 'Not all the provided principals exist!'});
                return;
            }

            // Ensure that we're not adding any circular dependencies by 
            // making sure that all the provided principals are NOT a parent of this group.
            // Basically the whole group graph needs to be a Directed Acyclical Graph.
            OAE.runQuery('SELECT * FROM MemberOf WHERE principal_id IN (?)', [principalsToAdd], function (err, rows) {
                if (err) {
                    callback({'code': 500, 'msg': err}, null);
                } else {
                    for (var i = 0; i < principalsToAdd.length;i++) {
                        if (typeof rows[0].colHash[principalsToAdd[i]] !== "undefined") {
                            callback({'code': 400, 'msg': 'You cannot make a parent group member of one of it\'s children.'}, null);
                            return;
                        }
                    }

                    // Get all the groups that this group is a member of so we can add them to the principallist later.
                    OAE.runQuery('SELECT * FROM MemberOf WHERE principal_id  = ?', [group_id], function (err, rows) {
                        if (err) {
                            callback({'code': 500, 'msg': err}, null);
                        } else {
                            var parentGroups = [];
                            for (var i = 0; i < rows[0].cols.length;i++) {
                                if (rows[0].cols[i].name !== "principal_id") {
                                    parentGroups.push(rows[0].cols[i].name);
                                }
                            }


                            
                            var q = [];
                            var parameters = [];
                            for (var i = 0; i < principalsToAdd.length;i++) {
                                q.push("?=?");
                                parameters.push(principalsToAdd[i]);
                                parameters.push("");
                            }
                            parameters.push(group_id);

                            OAE.runQuery("UPDATE GroupMembers SET " + q.join(', ') + " WHERE group_id = ?", parameters, function(err) {
                                if (err) {
                                    callback({'code': 500, 'msg': err}, null);
                                }
                                else {
                                    // Explode the principals and add them all in.
                                    explodePrincipals(principalsToAdd, false, function(err, users) {
                                        if (err) {
                                                callback({'code': 500, 'msg': err}, null);
                                        }
                                        else {
                                            users = principalsToAdd.concat(flatten(users));
                                            // We add this group to each principal his membership list.
                                            // We also need to add all the parent groups of this group to the membership list of each principal.
                                            var query = 'BEGIN BATCH USING CONSISTENCY ONE \n';
                                            var parameters = [];
                                            for (var i = 0; i < users.length;i++) {
                                                var parentGroupsQuery = "";
                                                for (var g = 0; g < parentGroups.length;g++) {
                                                    parentGroupsQuery += "?=?,";
                                                    parameters.push(parentGroups[g]);
                                                    parameters.push("");
                                                }
                                                query += "UPDATE MemberOf SET " + parentGroupsQuery + " ?=?  WHERE principal_id=?; \n";
                                                parameters.push(group_id);
                                                parameters.push("");
                                                parameters.push(users[i]);
                                            }
                                            query += 'APPLY BATCH;'
                                            OAE.runQuery(query, parameters, function(err) {
                                                if (err) {
                                                    callback({'code': 500, 'msg': err}, null);
                                                } else {
                                                    callback(false, null);
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });
};

/**
 * Create a new group within this tenant.
 * @param  {Tenant}   tenant      The current tenant
 * @param  {String}   name        The name of this group
 * @param  {String}   description A description for this group.
 * @param  {Function} callback    Standard callback function.
 */
module.exports.createGroup = function(tenant, name, description, callback) {
    var id = "g:" + tenant.id + ":" + name;

    // Create the group.
    OAE.runQuery('INSERT INTO Principals (principal_id, tenant, group_title, group_description) VALUES (?, ?, ?, ?)', [id, tenant.id, name, description], function (err) {
        if (err) {
            callback({'code': 500, 'msg': err}, null);
        } else {
            callback(false, id);
        }
    });
};


flatten = function(hash) {
    var arr = [];
    for (var key in hash) {
        if (hash.hasOwnProperty(key))
            arr.push(key)
    }

    return arr;
}

explodePrincipals = function(group_ids, only_users, callback) {
    // Use a hash so we don't have doubles (ie: fake a Set)
    var group_user_members = {};

    // Simple parallel tree recursion algorithm.
    // We multi-get all the groups on each level in the tree.
    // ie: This is breadth-first.
    OAE.runQuery("SELECT * FROM GroupMembers WHERE group_id IN (?)", [group_ids], function(err, rows) {
        var new_groups = [];
        // Iterate over the groups.
        for (var i = 0; i < rows.rowCount();i++) {
            // Iterate over the members in this group.
            for (var c = 0; c < rows[i]._colCount; c++) {
                var principal = rows[i].cols[c].name;
                if (principal === 'group_id')
                    continue;

                if (isGroup(principal)) {
                    // Explode this group further.
                    new_groups.push(principal);
                    if (!only_users) {
                        group_user_members[principal] = true;
                    }
                } else {
                    group_user_members[principal] = true;
                }
            }
        }

        if (new_groups.length > 0) {
            explodePrincipals(new_groups, only_users, function(err, principals) {
                for (var principal in principals) {
                    if (principals.hasOwnProperty(principal)) {
                        group_user_members[principal] = true;
                    }
                }
                callback(false, group_user_members);
            })
        }
        else {
            return callback(false, group_user_members);
        }
    });
};


/**
 * Explodes a group down to all its user principals.
 * @param  {String}   group_id   The ID of a group.
 * @param  {Function} callback   Callback method.
 * @return {[type]}
 */
module.exports.getGroupUsers = function(group_id, callback) {
    explodePrincipals([group_id], true, function(err, users) {
        var members = flatten(users);
        callback(false, members);
    });
}

/**
 * Check if an identifier really is a group identifier.
 * @param  {[type]}  group_id [description]
 * @return {Boolean}
 */
isGroup = function(group_id) {
    return (group_id.slice(0, 2) === "g:");
};



getMetaData = function(principals, callback) {
// Get the meta data for each member.
    OAE.runQuery('SELECT * FROM Principals WHERE principal_id IN (?)', [principals], function (err, rows) {
        if (err) {
            callback({'code': 500, 'msg': err}, null);
        } else {
            members = [];
            for (var i = 0, j = rows.rowCount(); i<j;i++) {
                if (rows[i].colHash.principal_id.slice(0, 2) === "g:") {
                    members.push(groupModel.rowToGroup(rows[i]));
                } else {
                    // todo abstract this.
                    members.push({'principal_id': rows[i].colHash.principal_id, 'tenant': rows[i].colHash.tenant, 'first_name': rows[i].colHash.user_first_name, 'last_name': rows[i].colHash.user_last_name})
                }
            }
            callback(false, members);
        }
    });
};