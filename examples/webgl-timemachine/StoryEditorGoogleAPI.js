(function () {
  "use strict";

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Create the class
  //
  var StoryEditorGoogleAPI = function (settings) {
    settings = typeof settings === "undefined" ? {} : settings;
    // Client ID and API key from the Developer Console
    var CLIENT_ID = '469566611033-9qaggmqhgangl8tcddkijk2tuvhufv0q.apps.googleusercontent.com';
    // Array of API discovery doc URLs for APIs used by the quickstart
    var DISCOVERY_DOCS = ["https://sheets.googleapis.com/$discovery/rest?version=v4", "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
    // Authorization scopes required by the API; multiple scopes can be included, separated by spaces.
    var SCOPES = "https://www.googleapis.com/auth/drive.file";

    var googleSignInStateChangeListeners = [];
    var on_ready = settings["on_ready"];
    var tokenClient;
    var gUser = {};


    async function initializeGapiClient() {
      await gapi.client.init({
          discoveryDocs: DISCOVERY_DOCS
      });
      initializeGoogleAccounts();
    }


    async function initializeGoogleAccounts() {
      var gUserStr = window.localStorage.getItem("et-story-editor-creds");
      if (gUserStr) {
        gUser = JSON.parse(gUserStr);
      }
      await google.accounts.id.initialize({
        client_id: CLIENT_ID,
        scope: SCOPES,
        auto_select: gUser.hasOwnProperty('email') ? true : false,
        cancel_on_tap_outside: false,
        callback: function(response) {
          if (response && response.credential) {
            const rawdata = jwt_decode(response.credential);
            gUser.email = rawdata.email;
            // The intent was to also save the current access_token but apparently the toke is no longer
            // valid when google.accounts.id.initialize is invoked again (i.e. on a new page load)
            window.localStorage.setItem("et-story-editor-creds", JSON.stringify({"email" : gUser.email}));
          }
        }
      });
      initializeGapiAuthorization();
    }


    function initializeGapiAuthorization() {
      tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          error_callback: '', // Defined at request time in handleAuthenticate
          callback: '', // Defined at request time in handleAuthenticate
      });
      on_ready(isAuthenticatedWithGoogle());
    }


    /**
     *  Load the auth2 library and API client library.
     */
    function handleGoogleAPILoad() {
      //gapi.load('client:auth2', initClient);
      gapi.load('client', initializeGapiClient);
    }


    var isAuthorizedWithGoogle = function() {
      return gUser.hasOwnProperty('access_token_expiration') && gUser.access_token_expiration > Math.floor(Date.now() / 1000);
    };
    this.isAuthorizedWithGoogle = isAuthorizedWithGoogle;


    var isAuthenticatedWithGoogle = function () {
      return gUser.hasOwnProperty('email');
    };
    this.isAuthenticatedWithGoogle = isAuthenticatedWithGoogle


    var addGoogleSignInStateChangeListener = function (listener) {
      googleSignInStateChangeListeners.push(listener);
    };
    this.addGoogleSignInStateChangeListener = addGoogleSignInStateChangeListener;


    var logUserIn = function() {
      return new Promise((resolve, reject) => {
        function _handle_prompt_events(event) {
          if (event.isNotDisplayed()) {
            // There are other reasons for this not being displayed.
            if (event.getNotDisplayedReason() === "suppressed_by_user") {
              // User had previously rejected one-tap pop-up and GIS is in its exponential cooldown phase...
              // The user would initially be locked out for 2 hours and if it is done several times, the user
              // could be locked out for 4+ weeks. Insane! So, we reset the relevant cookie and prompt again, because
              // more likely than not, the user accidently/had reason to hit cancel but would still like to use the tool.
              document.cookie =  "g_state=;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT";
              google.accounts.id.prompt(_handle_prompt_events);
            } else {
              reject(event);
            }
          } else if (event.isSkippedMoment()) {
            // Triggered when user does not accept the one-tap pop-up.
            reject(event);
          } else if (event.getDismissedReason() === "credential_returned") {
            for (var i = 0; i < googleSignInStateChangeListeners.length; i++) {
              googleSignInStateChangeListeners[i](true);
            }
            resolve(event);
          }
        }
        // Google's one-tap login pop-up
        google.accounts.id.prompt(_handle_prompt_events);
     });
    };
    this.logUserIn = logUserIn;


    var handleAuthorizeAndAuthenticate = function() {
      return new Promise((resolve, reject) => {
        try {
          // Reject this promise in the error callback for requestAccessToken() if it fails for some reason
          tokenClient.error_callback = async (resp) => {
            reject(resp);
          }

          // Settle this promise in the response callback for requestAccessToken()
          tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) {
              reject(resp);
            }

            // The user chose an account by this point, now we need to log them in.
            if (Object.keys(gUser).length === 0) {
              try {
                await logUserIn();
              } catch(e) {
                // Technically an e.isSkippedMoment() == 'user_cancel' is returned but
                // StoryEditor.js is already checking for 'popup_closed' error type for
                // Google's authorization step.
                reject({"type": "popup_closed"});
                return;
              }
            }

            // GIS has automatically updated gapi.client with the newly issued access token.
            var tokenInfo = gapi.client.getToken();

            // First time the user has retrieved a token for this session.
            if (!gUser.hasOwnProperty("access_token")) {
              for (var i = 0; i < googleSignInStateChangeListeners.length; i++) {
                googleSignInStateChangeListeners[i](true);
              }
            }

            gUser.access_token = tokenInfo.access_token;
            gUser.access_token_expiration = Math.floor(Date.now() / 1000) + tokenInfo.expires_in;
            resolve(resp);

            //return {token : gUser.access_token};
          };
          if (gUser.hasOwnProperty('email')) {
            tokenClient.requestAccessToken({ prompt: '', hint: gUser.email});
          } else {
            tokenClient.requestAccessToken({ prompt: 'select_account' });
          }
        } catch (err) {
          reject(err);
        }
      });
    };
    this.handleAuthorizeAndAuthenticate = handleAuthorizeAndAuthenticate;


    var handleSignoutClick = function() {
      const token = gapi.client.getToken();
      if (token !== null) {
        // This makes you need to reapprove the app? I thought that's what
        // calling google.accounts.id.revoke does...
        //google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
      }
      gUser = {};
      window.localStorage.setItem("et-story-editor-creds", JSON.stringify(gUser));
      for (var i = 0; i < googleSignInStateChangeListeners.length; i++) {
        googleSignInStateChangeListeners[i](false);
      }
      initializeGoogleAccounts();
    };
    this.handleSignoutClick = handleSignoutClick;


    /**
     * List all the spreadsheets from Drive of an authenticated user
     */
    var listSpreadsheets = async function () {

      if (gUser.access_token_expiration < Math.floor(Date.now() / 1000)) {
        await handleAuthenticate();
      }

      return gapi.client.drive.files.list({
        'pageSize': 1000,
        'fields': "nextPageToken, files(id, name)",
        'q': "(mimeType='application/vnd.google-apps.spreadsheet') and trashed=false",
        'Authorization': 'Bearer ' + gUser.access_token
      }).then(function (response) {
        return response.result.files;
      })
    };
    this.listSpreadsheets = listSpreadsheets;


    /**
     * Make a file publicly viewable on Drive
     */
    var makeFilePublicViewable = async function (fileId) {

      if (gUser.access_token_expiration < Math.floor(Date.now() / 1000)) {
        await handleAuthenticate();
      }

      var filePermissionBody = {
        "role": "reader",
        "type": "anyone",
      };
      var request = gapi.client.drive.permissions.create({
        'fileId': fileId
      }, filePermissionBody);
      return request.then(function (response) {
        var result = {
          status: "success",
          fileId: fileId
        }
        return result;
      }, function (errorResponse) {
        throw errorResponse;
      });
    };
    this.makeFilePublicViewable = makeFilePublicViewable;


    /**
     * Create a new empty spreadsheet and save it to the currently authenticated user
     *
     * Note: The sheets API is used here rather than the Drive API. This means we have
     * to do an extra step to make it readable by the public. However, by going through
     * the Sheets API it also allows us to initially customize the sheet rather than having to
     * do another request later. So either way, multiple requests will happen for what we want.
     * It also appears that we need to explictly set a sheetId or a random one will be given.
     * It is possible that if we instead went the route of the Drive API we would be unable to set
     * such an id.
     */
    var createEmptySpreadsheet = async function (spreadsheetTitle) {

      if (gUser.access_token_expiration < Math.floor(Date.now() / 1000)) {
        await handleAuthenticate();
      }

      spreadsheetTitle = spreadsheetTitle ? spreadsheetTitle : "EarthTime Stories - " + (new Date()).getTime();
      var spreadsheetBody = {
        properties: {
          title: spreadsheetTitle
        },
        sheets: [{
          /*conditionalFormats: [
            {
              booleanRule: {
                format: {
                  textFormat: {
                    bold: true
                  }
                },
                condition: {
                  type: "NOT_BLANK"
                }
              },
              ranges: [
                {
                  endRowIndex: 1
                }
              ]
            }
          ],*/
          properties: {
            sheetId: 0,
            gridProperties: {
              columnCount: 8,
              frozenRowCount: 1
            }
          },
        }]
      };
      var request = gapi.client.sheets.spreadsheets.create({}, spreadsheetBody);
      return request.then(function (response) {
        var result = {
          status: "success",
          spreadsheetId: response.result.spreadsheetId,
          spreadsheetUrl: response.result.spreadsheetUrl,
          spreadsheetTitle: response.result.properties.title
        };
        return result;
      }).then(function (initialResult) {
        return makeFilePublicViewable(initialResult.spreadsheetId).then(function (response) {
          return initialResult;
        }).catch(function (errorResponse) {
          throw errorResponse;
        });
      }).then(function (initialResult) {
        return formatCellsInSpreadsheet(initialResult.spreadsheetId).then(function (response) {
          return initialResult;
        }).catch(function (errorResponse) {
          throw errorResponse;
        });
      }).catch(function (errorResponse) {
        throw errorResponse;
      });
    };
    this.createEmptySpreadsheet = createEmptySpreadsheet;


    /**
     * Create a spreadsheet and write content to it
     */
    var createNewSpreadsheetWithContent = async function (spreadsheetTitle, content) {

      if (gUser.access_token_expiration < Math.floor(Date.now() / 1000)) {
        await handleAuthenticate();
      }

      return createEmptySpreadsheet(spreadsheetTitle).then(function (response) {
        response.content = content;
        return response;
      }).then(function (initialResult) {
        return writeContentToSpreadsheet(initialResult.spreadsheetId, initialResult.content).then(function (response) {
          return initialResult;
        }).catch(function (errorResponse) {
          throw errorResponse;
        });
      }).catch(function (errorResponse) {
        throw {
          status: "error",
          message: errorResponse.result.error.message
        };
      });
    };
    this.createNewSpreadsheetWithContent = createNewSpreadsheetWithContent;


    /**
     * Change the formatting of the cells in a spreadsheet
     * In this case, make the top row fixed and its content bold and all cells to be left aligned and content clipped
     */
    var formatCellsInSpreadsheet = async function (spreadsheetId) {

      if (gUser.access_token_expiration < Math.floor(Date.now() / 1000)) {
        await handleAuthenticate();
      }

      var updateBody = {
        "requests": [{
            "repeatCell": {
              "range": {
                "endRowIndex": 1,
              },
              "cell": {
                "userEnteredFormat": {
                  "textFormat": {
                    "bold": true
                  }
                }
              },
              "fields": "userEnteredFormat(textFormat)"
            }
          },
          {
            "repeatCell": {
              "range": {
                "startRowIndex": 0
              },
              "cell": {
                "userEnteredFormat": {
                  "horizontalAlignment": "LEFT",
                  "wrapStrategy": "clip"
                }
              },
              "fields": "userEnteredFormat(horizontalAlignment,wrapStrategy)"
            }
          },
          {
            "updateSheetProperties": {
              "properties": {
                "gridProperties": {
                  "frozenRowCount": 1
                }
              },
              "fields": "gridProperties.frozenRowCount"
            }
          }
        ]
      };
      return gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId
      }, updateBody).then(function (response) {
        var result = {
          status: "success",
          spreadsheetId: response.result.spreadsheetId
        };
        return result;
      }, function (errorResponse) {
        throw errorResponse;
      });
    };
    this.formatCellsInSpreadsheet = formatCellsInSpreadsheet;


    /**
     * Read the contents of a specific spreadsheet based on its ID
     * UNUSED: It is left here as an API call example but in the context
     * of the story editor, this specific function is not used and potentially bitrotted.
     */
    var readSpreadsheet = async function (spreadsheetId) {

      if (gUser.access_token_expiration < Math.floor(Date.now() / 1000)) {
        await handleAuthenticate();
      }

      // Note: To edit a specific tab of the sheet, specify request like so. Single quotes required around the name of the Sheet tab.
      // range: "'sheet1'!A:Z"
      return gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: 'A:Z',
      }).then(function (response) {
        var range = response.result;
        if (range.values.length > 0) {
          for (i = 0; i < range.values.length; i++) {
            var row = range.values[i];
            // Print columns A through D, which correspond to indices 0 through 3.
            console.log(row[0] + ' | ' + row[1] + ' | ' + row[2] + ' | ' + row[3]);
          }
        } else {
          console.log('No data found.');
        }
      }, function (errorResponse) {
        throw errorResponse;
      });
    };
    this.readSpreadsheet = readSpreadsheet;


    /**
     * Update the contents of spreadsheet by first clearing out all the values and then writing new ones
     * If a new title is provided, update that as well.
     */
    var updateSpreadsheet = async function (spreadsheetId, content, newTitle) {

      if (gUser.access_token_expiration < Math.floor(Date.now() / 1000)) {
        await handleAuthenticate();
      }

      return clearSpreadsheet(spreadsheetId).then(function (response) {
        response.content = content;
        response.newTitle = newTitle;
        return response;
      }).then(function (initialResult) {
        return writeContentToSpreadsheet(initialResult.spreadsheetId, initialResult.content).then(function (response) {
          return initialResult;
        }).catch(function (errorResponse) {
          throw errorResponse;
        });
      }).then(function (initialResult) {
        if (initialResult.newTitle) {
          return updateSpreadsheetTitle(initialResult.spreadsheetId, initialResult.newTitle).then(function (response) {
            return initialResult;
          }).catch(function (errorResponse) {
            throw errorResponse;
          });
        } else {
          return initialResult;
        }
      }).catch(function (errorResponse) {
        throw {
          status: "error",
          message: errorResponse.result.error.message
        };
      });
    };
    this.updateSpreadsheet = updateSpreadsheet;


    /**
     * Write out content to a spreadsheet
     */
    var writeContentToSpreadsheet = async function (spreadsheetId, content) {

      if (gUser.access_token_expiration < Math.floor(Date.now() / 1000)) {
        await handleAuthenticate();
      }

      var updateBody = {
        "majorDimension": "ROWS",
        "values": content
      };

      // Note: To edit a specific tab of the sheet, specify request like so. Single quotes required around the name of the Sheet tab.
      // range: "'sheet1'!A:Z"
      return gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        valueInputOption: 'USER_ENTERED',
        range: 'A:Z'
      }, updateBody).then(function (response) {
        var result = {
          status: "success",
          spreadsheetId: response.result.spreadsheetId
        };
        return result;
      }, function (errorResponse) {
        throw errorResponse;
      });
    };
    this.writeContentToSpreadsheet = writeContentToSpreadsheet;


    /**
     * Clear out the contents of a spreadsheet
     */
    var clearSpreadsheet = async function (spreadsheetId) {

      if (gUser.access_token_expiration < Math.floor(Date.now() / 1000)) {
        await handleAuthenticate();
      }

      // Note: To edit a specific tab of the sheet, specify request like so. Single quotes required around the name of the Sheet tab.
      // range: "'sheet1'!A:Z"
      return gapi.client.sheets.spreadsheets.values.clear({
        spreadsheetId: spreadsheetId,
        range: 'A:Z',
      }).then(function (response) {
        var result = {
          status: "success",
          spreadsheetId: response.result.spreadsheetId
        };
        return result;
      }, function (errorResponse) {
        throw errorResponse;
      });
    };
    this.clearSpreadsheet = clearSpreadsheet;


    /**
     * Change the title of a spreadsheet
     */
    var updateSpreadsheetTitle = async function (spreadsheetId, spreadsheetTitle) {

      if (gUser.access_token_expiration < Math.floor(Date.now() / 1000)) {
        await handleAuthenticate();
      }

      var updateBody = {
        "requests": [{
          "updateSpreadsheetProperties": {
            "properties": {
              "title": spreadsheetTitle
            },
            "fields": "title"
          }
        }]
      };
      return gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId
      }, updateBody).then(function (response) {
        var result = {
          status: "success",
          spreadsheetId: response.result.spreadsheetId
        };
        return result;
      }, function (errorResponse) {
        throw errorResponse;
      });
    };
    this.updateSpreadsheetTitle = updateSpreadsheetTitle;


    /**
     * Get the metadata for a spreadsheet.
     * Includes information like spreadsheet title, as well as individual sheet tab names, etc.
     */
    var getSpreadsheetInfo = async function(spreadsheetId) {

      if (gUser.access_token_expiration < Math.floor(Date.now() / 1000)) {
        await handleAuthenticate();
      }

      return gapi.client.sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId,
      }).then(function (response) {
        var result = {
          status: "success",
          info: response.result
        };
        return result;
      }, function (errorResponse) {
        throw {
          status: "error",
          message: errorResponse
        };
      });
    }
    this.getSpreadsheetInfo = getSpreadsheetInfo;


    /**
     * Get the title of a Google Drive file
     */
    var getFileName = async function(fileId) {

      if (gUser.access_token_expiration < Math.floor(Date.now() / 1000)) {
        await handleAuthenticate();
      }

      return gapi.client.drive.files.get({
        fileId: fileId,
      }).then(function (response) {
        var result = {
          status: "success",
          fileName: response.result.name
        };
        return result;
      }, function (errorResponse) {
        throw {
          status: "error",
          message: errorResponse
        };
      });
    }
    this.getFileName = getFileName;


    // Constructor

    // Load Google API script
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://apis.google.com/js/api.js";
    script.onload = function () {
      handleGoogleAPILoad();
    };

    // Relevant for IE and pre-Chromium Opera. Both are defunct now.
    // May be required for mobile Safari/Android?
    script.onreadystatechange = function () {
      if (this.readyState === 'complete') {
        this.onload();
      }
    };
    script.defer = true;
    script.async = true;
    document.head.appendChild(script);

    // Load Google Identity Services (required as of 3/2023)
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://accounts.google.com/gsi/client";
    script.defer = true;
    script.async = true;
    document.head.appendChild(script);

    // Extacting user info from GIS requires parsing JWT responses
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://cdn.jsdelivr.net/npm/jwt-decode@3/build/jwt-decode.min.js";
    script.defer = true;
    script.async = true;
    document.head.appendChild(script);

  };

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Register to window
  //
  if (!window.StoryEditorGoogleAPI) {
    window.StoryEditorGoogleAPI = StoryEditorGoogleAPI;
  }
})();
