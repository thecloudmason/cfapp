/*
 *  Copyright (c) 2017 NiXPS, All rights reserved.
 *
 *  This Source Code Form is subject to the terms of the Mozilla Public
 *  License, v. 2.0. If a copy of the MPL was not distributed with this
 *  file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 */

'use strict';

const { assert } = require('chai');
const nock = require('nock');
const fs = require('fs');
const mkdirp = require('mkdirp');
const remove = require('remove');
const streamify = require('stream-array');
const os = require('os');

const APIMockDelegate = require('../util/APIMockDelegate');
const cfapp = require('../../lib/cfapp');
const apiMock = require('cloudflow-api');
const JSONOutputStream = require('../../lib/util/JSONOutputStream');


function getFileDownloadMock(downloadedFiles, expected) {
    const downloadFileURLRegex = /portal.cgi\?dl=(.*)&session=session_admin_admin/;

    nock('http://localhost:9090')
        .get(downloadFileURLRegex, function() {
            return true;
        })
        .times(expected)
        .reply(200, function(uri) {
            const matches = uri.match(downloadFileURLRegex);
            if (Array.isArray(matches) && matches.length > 1) {
                downloadedFiles.push(matches[1]);
            }

            return streamify(['1', '2', '3', os.EOF]);
        }, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="file.pdf"'
        });
}

function downloadTests() {
    class ExistingSingleAppDelegate extends APIMockDelegate {
        doesExist(url) {
            if (url === 'cloudflow://PP_FILE_STORE/DownloadApp/images/') {
                return {
                    exists: true,
                    is_folder: true,
                    url: url
                };
            }
            else if (url === 'cloudflow://PP_FILE_STORE/DownloadApp/index.html') {
                return {
                    exists: true,
                    is_folder: false,
                    url: url
                };
            }

            return super.doesExist(url);
        }

        existingAssets(query) {
            if (query[2] === 'cloudflow://PP_FILE_STORE/DownloadApp/images/win.png') {
                return [{
                    _id: 'I exist',
                    cloudflow: {
                        file: 'cloudflow://PP_FILE_STORE/DownloadApp/images/win.png'
                    }
                }];
            }
            else if (query[2] === 'cloudflow://PP_FILE_STORE/DownloadApp/images/mac.png') {
                return [{
                    _id: 'I exist too',
                    cloudflow: {
                        file: 'cloudflow://PP_FILE_STORE/DownloadApp/images/mac.png'
                    }
                }];
            } else if (query[2] === 'cloudflow://PP_FILE_STORE/DownloadApp/images/') {
                // Get the assets in the image folder
                return [{
                    _id: 'I exist',
                    cloudflow: {
                        file: 'cloudflow://PP_FILE_STORE/DownloadApp/images/win.png'
                    }
                }, {
                    _id: 'I exist too',
                    cloudflow: {
                        file: 'cloudflow://PP_FILE_STORE/DownloadApp/images/mac.png'
                    }
                }];
            }

            return [];
        }

        existingWhitepapers() {
            return [ {
                _id: 'Workflow1',
                name: 'Workflow1'
            }, {
                _id: 'Workflow2',
                name: 'Workflow2'
            }];
        }

        existingFolders(query) {
            if (query[2] === 'cloudflow://PP_FILE_STORE/DownloadApp/images/') {
                return [ 'images' ];
            }

            return [];
        }
    }


    class AssetDoesExistThrowsErrorAppDelegate extends APIMockDelegate {
        doesExist() {
            throw new Error('Parameter Error');
        }

        existingAssets() {
            return [ ];
        }

        existingWhitepapers() {
            return [ ];
        }

        existingFolders() {
            return [ ];
        }
    }


    const projectCFApp = {
        name: 'DownloadApp',
        host: 'http://localhost:9090',
        login: 'admin',
        password: 'admin',
        description: 'A test for downloading an application',

        files: [
            'cloudflow://PP_FILE_STORE/DownloadApp/images/',
            'cloudflow://PP_FILE_STORE/DownloadApp/index.html',
        ],

        workflows: [
            'Workflow1',
            'Workflow2'
        ]
    };


    after(function() {
        if (fs.existsSync(__dirname + '/downloadTest')) {
            remove.removeSync(__dirname + '/downloadTest');
        }
    });

    it('download a single application', function() {
        const outputStream = new JSONOutputStream();
        apiMock.mockDelegate = new ExistingSingleAppDelegate();

        const downloadedFiles = [];
        getFileDownloadMock(downloadedFiles, 3);

        if (fs.existsSync(__dirname + '/downloadTest') === true) {
            remove.removeSync(__dirname + '/downloadTest');
        }
        mkdirp.sync(__dirname + '/downloadTest/DownloadApp');
        fs.writeFileSync(__dirname + '/downloadTest/DownloadApp/project.cfapp', JSON.stringify(projectCFApp));

        return cfapp.apps.download(__dirname + '/downloadTest/DownloadApp', {}, outputStream).then(function() {
            const mockDelegate = apiMock.mockDelegate;
            assert.equal(mockDelegate.downloadedWhitepapers.length, 2, 'not all whitepapers were downloaded');
            assert.includeMembers(mockDelegate.downloadedWhitepapers, [
                'Workflow1',
                'Workflow2'
            ], 'not all whitepapers were downloaded');
            assert.equal(downloadedFiles.length, 3, 'not all files were downloaded');
            assert.includeMembers(downloadedFiles, [
                'cloudflow://PP_FILE_STORE/DownloadApp/images/win.png',
                'cloudflow://PP_FILE_STORE/DownloadApp/images/mac.png',
                'cloudflow://PP_FILE_STORE/DownloadApp/index.html'
            ], 'not all files were downloaded');
            assert(nock.isDone(), 'expected requests not performed');

            // TODO: assert file structure too
        });
    });

    it('should not overwrite', function() {
        const outputStream = new JSONOutputStream();
        apiMock.mockDelegate = new ExistingSingleAppDelegate();

        const downloadedFiles = [];
        getFileDownloadMock(downloadedFiles, 3);

        const projectCFApp = {
            name: 'DownloadApp',
            host: 'http://localhost:9090',
            login: 'admin',
            password: 'admin',
            description: 'A test for downloading an application',

            files: [
                'cloudflow://PP_FILE_STORE/DownloadApp/images/',
                'cloudflow://PP_FILE_STORE/DownloadApp/index.html',
            ],

            workflows: [
                'Workflow1',
                'Workflow2'
            ]
        };

        if (fs.existsSync(__dirname + '/downloadTest') === true) {
            remove.removeSync(__dirname + '/downloadTest');
        }
        mkdirp.sync(__dirname + '/downloadTest/DownloadApp');
        fs.writeFileSync(__dirname + '/downloadTest/DownloadApp/project.cfapp', JSON.stringify(projectCFApp));

        return cfapp.apps.download(__dirname + '/downloadTest/DownloadApp', {}, outputStream).then(function() {
            // Reset the mock delegate
            nock.cleanAll();
            apiMock.mockDelegate = new ExistingSingleAppDelegate();
            const downloadedFiles = [];
            getFileDownloadMock(downloadedFiles, 1);

            return cfapp.apps.download(__dirname + '/downloadTest/DownloadApp', {}, outputStream).then(function() {
                const mockDelegate = apiMock.mockDelegate;
                assert.equal(mockDelegate.downloadedWhitepapers.length, 0, 'no whitepapers should be downloaded');
                assert.equal(downloadedFiles.length, 0, 'no files should be downloaded');
                assert(nock.isDone() === false, 'requests were performed while none expected');
                // TODO: assert file structure too
            });
        });
    });


    it('should overwrite when the flag is set', function() {
        const outputStream = new JSONOutputStream();
        apiMock.mockDelegate = new ExistingSingleAppDelegate();

        const downloadedFiles = [];
        getFileDownloadMock(downloadedFiles, 3);

        if (fs.existsSync(__dirname + '/downloadTest') === true) {
            remove.removeSync(__dirname + '/downloadTest');
        }
        mkdirp.sync(__dirname + '/downloadTest/DownloadApp');
        fs.writeFileSync(__dirname + '/downloadTest/DownloadApp/project.cfapp', JSON.stringify(projectCFApp));

        return cfapp.apps.download(__dirname + '/downloadTest/DownloadApp', {}, outputStream).then(function() {
            // Reset the mock delegate
            nock.cleanAll();
            apiMock.mockDelegate = new ExistingSingleAppDelegate();
            const downloadedFiles = [];
            getFileDownloadMock(downloadedFiles, 3);

            return cfapp.apps.download(__dirname + '/downloadTest/DownloadApp', {
                overwrite: true
            }, outputStream).then(function() {
                const mockDelegate = apiMock.mockDelegate;
                assert.equal(mockDelegate.downloadedWhitepapers.length, 2, 'not all whitepapers were downloaded');
                assert.includeMembers(mockDelegate.downloadedWhitepapers, [
                    'Workflow1',
                    'Workflow2'
                ], 'not all whitepapers were downloaded');
                assert.equal(downloadedFiles.length, 3, 'not all files were downloaded');
                assert.includeMembers(downloadedFiles, [
                    'cloudflow://PP_FILE_STORE/DownloadApp/images/win.png',
                    'cloudflow://PP_FILE_STORE/DownloadApp/images/mac.png',
                    'cloudflow://PP_FILE_STORE/DownloadApp/index.html'
                ], 'not all files were downloaded');
                assert(nock.isDone(), 'expected requests not performed');
            });
        });
    });

    it('should throw an error when a file that needs to be downloaded does not exist', function() {
        class RemoteFilesDoNotExistAppDelegate extends APIMockDelegate {
            existingAssets() {
                return [];
            }

            existingWhitepapers() {
                return [ {
                    _id: 'Workflow1',
                    name: 'Workflow1'
                }, {
                    _id: 'Workflow2',
                    name: 'Workflow2'
                }];
            }

            existingFolders() {
                return [];
            }
        }

        const outputStream = new JSONOutputStream();
        apiMock.mockDelegate = new RemoteFilesDoNotExistAppDelegate();

        const downloadedFiles = [];
        getFileDownloadMock(downloadedFiles, 0);

        if (fs.existsSync(__dirname + '/downloadTest') === true) {
            remove.removeSync(__dirname + '/downloadTest');
        }
        mkdirp.sync(__dirname + '/downloadTest/DownloadApp');
        fs.writeFileSync(__dirname + '/downloadTest/DownloadApp/project.cfapp', JSON.stringify(projectCFApp));

        return cfapp.apps.download(__dirname + '/downloadTest/DownloadApp', {}, outputStream).then(function() {
            assert.notOk('the promise should not resolve if a folder is missing on the remote Cloudflow');
        }).catch(function(error) {
            assert.equal(error.errorCode, 'CFAPPERR014');
            assert.equal(error.message, 'Specified file does not exist "cloudflow://PP_FILE_STORE/DownloadApp/images/" on the remote Cloudflow');
        });
    });

    it('should show an appropriate error code when no project.cfapp file is found', function() {
        const outputStream = new JSONOutputStream();
        apiMock.mockDelegate = new ExistingSingleAppDelegate();

        const downloadedFiles = [];
        getFileDownloadMock(downloadedFiles, 0);

        if (fs.existsSync(__dirname + '/downloadTest') === true) {
            remove.removeSync(__dirname + '/downloadTest');
        }
        mkdirp.sync(__dirname + '/downloadTest/DownloadApp');

        assert.throws(function() {
            cfapp.apps.download(__dirname + '/downloadTest/DownloadApp/', {}, outputStream).then(function() {
                assert.isNotOk(true, 'this function should have failed earlier (then)');
            }).catch(function() {
                assert.isNotOk(true, 'this function should have failed earlier (catch)');
            });
        }, /^Missing 'project\.cfapp' file/, 'an error should be returned');

        assert.equal(downloadedFiles.length, 0, 'no files should be uploaded');
    });

    it('should show an appropriate error code when does_exist fails with a "Parameter Error"', function() {
        const projectCFApp = {
            name: 'DownloadApp',
            host: 'http://localhost:9090',
            login: 'admin',
            password: 'admin',
            description: 'A test for downloading an application',

            files: [
                'cloudflow://PP_FILE_STORE'
            ],

            workflows: [ ]
        };

        const outputStream = new JSONOutputStream();
        apiMock.mockDelegate = new AssetDoesExistThrowsErrorAppDelegate();

        if (fs.existsSync(__dirname + '/downloadTest') === true) {
            remove.removeSync(__dirname + '/downloadTest');
        }
        mkdirp.sync(__dirname + '/downloadTest/DownloadApp');
        fs.writeFileSync(__dirname + '/downloadTest/DownloadApp/project.cfapp', JSON.stringify(projectCFApp));

        const downloadedFiles = [];
        getFileDownloadMock(downloadedFiles, 0);

        return cfapp.apps.download(__dirname + '/downloadTest/DownloadApp/', {}, outputStream).then(function() {
            assert.isNotOk(true, 'this function should have failed after then');
        }).catch(function(error) {
            assert.equal(error.errorCode, 'CFAPPERR016', 'wrong error code is returned');
            assert.match(error, /^Error: api\.file\.does_exist failed for path/, 'wrong error message returned');
        });
    });

}

module.exports = downloadTests;
