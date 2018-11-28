/*
 *  Copyright (c) 2017 NiXPS, All rights reserved.
 *
 *  This Source Code Form is subject to the terms of the Mozilla Public
 *  License, v. 2.0. If a copy of the MPL was not distributed with this
 *  file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 */


'use strict';

module.exports = {
    command: 'start',
    desc: 'Starts the installed Cloudflow',
    builder: {},
    handler: function() {
        var systeminfo=require("../../../lib/systeminfo.js");
        var cloudflow = systeminfo.get_cloudflow_info();

        console.log("Running " + cloudflow.version);
        console.log("from "+cloudflow.setup.app_folder);

        const { execSync } = require('child_process'); 
        try
        {
            if (cloudflow.setup.run_as_service)
            {
                var command=cloudflow.nucleusd+" --start";
                console.log(command);
                let input = execSync(command);
                console.log(input.toString());
            } else
            {
                var command=cloudflow.nucleusd+cloudflow.setup.cmd;
                console.log(command);
                let input = execSync(cloudflow.nucleusd+cloudflow.setup.cmd);
                console.log(input.toString());
            }
        } catch(e)
        {
            //console.log(e);
        }
    }
};
