var express = require('express');

///////////
// Model //
///////////

module.exports.Group = function(tenant, principal_id, name, description, privacy) {
    
    var that = {};

    that.principal_id = principal_id;
    that.tenant = tenant;
    that.name = name;
    that.description = description;
    that.privacy = privacy;

    return that;
    
};

module.exports.rowToGroup = function (row) {
	return {'tenant':row.colHash.tenant,
			'principal_id': row.colHash.principal_id,
			'group_title': row.colHash.group_title, 
			'group_description': row.colHash.group_description, 
			'privacy_setting': row.colHash.group_privacy_setting};
}