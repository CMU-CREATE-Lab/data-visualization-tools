(function () {
  "use strict";

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Create the class
  //
  var StoryEditorGoogleAPI = function () {
    // Client ID and API key from the Developer Console
    var CLIENT_ID = '469566611033-9qaggmqhgangl8tcddkijk2tuvhufv0q.apps.googleusercontent.com';
    // Array of API discovery doc URLs for APIs used by the quickstart
    var DISCOVERY_DOCS = ["https://sheets.googleapis.com/$discovery/rest?version=v4", "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
    // Authorization scopes required by the API; multiple scopes can be included, separated by spaces.
    var SCOPES = "https://www.googleapis.com/auth/drive.file";

    var tmpListeners = [];

    /**
     *  Initializes the API client library and sets up sign-in state
     *  listeners.
     */
    function initClient() {
      gapi.client.init({
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES
      }).then(function () {
        for (var i = 0; i < tmpListeners.length; i++) {
          gapi.auth2.getAuthInstance().isSignedIn.listen(tmpListeners[i]);
        }
        tmpListeners = [];
      });
    }

    /**
     *  Load the auth2 library and API client library.
     */
    function handleGoogleAPILoad() {
      gapi.load('client:auth2', initClient);
    }

    var isAuthenticatedWithGoogle = function() {
      var authInstance = gapi.auth2.getAuthInstance();
      var isAuthenticated = false;
      if (authInstance) {
        isAuthenticated = authInstance.isSignedIn.get();
      }
      return isAuthenticated;
    };
    this.isAuthenticatedWithGoogle = isAuthenticatedWithGoogle;

    var addGoogleSignedInStateChangeListener = function(listener) {
      if (typeof(gapi) !== "undefined" && gapi.auth2 && gapi.auth2.getAuthInstance()) {
        gapi.auth2.getAuthInstance().isSignedIn.listen(listener);
      } else {
        tmpListeners.push(listener);
      }
    };
    this.addGoogleSignedInStateChangeListener = addGoogleSignedInStateChangeListener;

    /**
     *  Sign in the user upon button click.
     */
    var handleAuthClick = function(event) {
      return gapi.auth2.getAuthInstance().signIn().then(function(response) {
        return {userId: response.getId()};
      }).catch(function(errorResponse) {
        // TODO: Maybe throw to get caught further up?
        // Right now the only known error that gets caught is if the login pop-up is closed.
        // There might be more though if authentication fails for whatever reason.
      });
    };
    this.handleAuthClick = handleAuthClick;

    /**
     *  Sign out the user upon button click.
     */
    var handleSignoutClick = function(event) {
      gapi.auth2.getAuthInstance().signOut();
    };
    this.handleSignoutClick = handleSignoutClick;

    /**
     * List all the spreadsheets from Drive of an authenticated user
     */
    var listSpreadsheets = function() {
      return gapi.client.drive.files.list({
        'pageSize': 1000,
        'fields': "nextPageToken, files(id, name)",
        'q': "(mimeType='application/vnd.google-apps.spreadsheet')",
      }).then(function(response) {
        return response.result.files;
      });
    };
    this.listSpreadsheets = listSpreadsheets;

    /**
      * Make a file publicly viewable on Drive
      */
    var makeFilePublicViewable = function(fileId) {
      var filePermissionBody = {
        "role": "reader",
        "type": "anyone",
      };
      var request = gapi.client.drive.permissions.create({'fileId': fileId}, filePermissionBody);
      return request.then(function(response) {
        var result = {status: "success", fileId: fileId}
        return result;
      }, function(errorResponse) {
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
    var createEmptySpreadsheet = function(spreadsheetTitle) {
      spreadsheetTitle = spreadsheetTitle ? spreadsheetTitle : "EarthTime Stories - " + (new Date()).getTime();
      var spreadsheetBody = {
        properties: {
          title: spreadsheetTitle
        },
        sheets: [
          {
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
          }
        ]
      };
      var request = gapi.client.sheets.spreadsheets.create({}, spreadsheetBody);
      return request.then(function(response) {
        var result = {status: "success", spreadsheetId: response.result.spreadsheetId, spreadsheetUrl: response.result.spreadsheetUrl, spreadsheetTitle: response.result.properties.title};
        return result;
      }).then(function(initialResult) {
        return makeFilePublicViewable(initialResult.spreadsheetId).then(function(response) {
          return initialResult;
        }).catch(function(errorResponse) {
          throw errorResponse;
        });
      }).then(function(initialResult) {
        return formatCellsInSpreadsheet(initialResult.spreadsheetId).then(function(response) {
          return initialResult;
        }).catch(function(errorResponse) {
          throw errorResponse;
        });
      }).catch(function(errorResponse) {
        throw errorResponse;
      });
    };
    this.createEmptySpreadsheet = createEmptySpreadsheet;

    /**
      * Create a spreadsheet and write content to it
      */
    var createNewSpreadsheetWithContent = function(spreadsheetTitle, content) {
      return createEmptySpreadsheet(spreadsheetTitle).then(function(response) {
        response.content = content;
        return response;
      }).then(function(initialResult) {
        return writeContentToSpreadsheet(initialResult.spreadsheetId, initialResult.content).then(function(response) {
          return initialResult;
        }).catch(function(errorResponse) {
          throw errorResponse;
        });
      }).catch(function(errorResponse) {
        throw {status: "error", message: errorResponse.result.error.message};
      });
    };
    this.createNewSpreadsheetWithContent = createNewSpreadsheetWithContent;

    /**
      * Change the formatting of the cells in a spreadsheet
      * In this case, make the top row fixed and its content bold and all cells to be left aligned and content clipped
      */
    var formatCellsInSpreadsheet = function(spreadsheetId) {
      var updateBody = {
        "requests": [
          {
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
                  "horizontalAlignment" : "LEFT",
                  "wrapStrategy" : "clip"
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
        spreadsheetId: spreadsheetId}, updateBody
      ).then(function(response) {
        var result = {status: "success", spreadsheetId: response.result.spreadsheetId};
        return result;
      }, function(errorResponse) {
        throw errorResponse;
      });
    };
    this.formatCellsInSpreadsheet = formatCellsInSpreadsheet;

    /**
      * Read the contents of a specific spreadsheet based on its ID
      * UNUSED: It is left here as an API call example but in the context
      * of the story editor, this specific function is not used and potentially bitrotted.
      */
    var readSpreadsheet = function(spreadsheetId) {
      return gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: 'A:Z',
      }).then(function(response) {
        var range = response.result;
        if (range.values.length > 0) {
          for (i = 0; i < range.values.length; i++) {
            var row = range.values[i];
            // Print columns A through D, which correspond to indices 0 and 3.
            console.log(row[0] + ' | ' + row[1] + ' | ' + row[2] + ' | ' + row[3]);
          }
        } else {
          console.log('No data found.');
        }
      }, function(errorResponse) {
        throw errorResponse;
      });
    };
    this.readSpreadsheet = readSpreadsheet;

    /**
      * Update the contents of spreadsheet by first clearing out all the values and then writing new ones
      * If a new title is provided, update that as well.
      */
    var updateSpreadsheet = function(spreadsheetId, content, newTitle) {
      return clearSpreadsheet(spreadsheetId).then(function(response) {
        response.content = content;
        response.newTitle = newTitle;
        return response;
      }).then(function(initialResult) {
        return writeContentToSpreadsheet(initialResult.spreadsheetId, initialResult.content).then(function(response) {
          return initialResult;
        }).catch(function(errorResponse) {
          throw errorResponse;
        });
      }).then(function(initialResult) {
        if (initialResult.newTitle) {
          return updateSpreadsheetTitle(initialResult.spreadsheetId, initialResult.newTitle).then(function(response) {
            return initialResult;
          }).catch(function(errorResponse) {
            throw errorResponse;
          });
        } else {
          return initialResult;
        }
      }).catch(function(errorResponse) {
        throw {status: "error", message: errorResponse.result.error.message};
      });
    };
    this.updateSpreadsheet = updateSpreadsheet;

    /**
      * Write out content to a spreadsheet
      */
    var writeContentToSpreadsheet = function(spreadsheetId, content) {
      var updateBody = {
        "majorDimension": "ROWS",
        "values": content
      };
      return gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId, valueInputOption: 'USER_ENTERED', range: "A:Z"}, updateBody
      ).then(function(response) {
        var result = {status: "success", spreadsheetId: response.result.spreadsheetId};
        return result;
      }, function(errorResponse) {
        throw errorResponse;
      });
    };
    this.writeContentToSpreadsheet = writeContentToSpreadsheet;

    /**
      * Clear out the contents of a spreadsheet
      */
    var clearSpreadsheet = function(spreadsheetId) {
      return gapi.client.sheets.spreadsheets.values.clear({
        spreadsheetId: spreadsheetId,
        range: 'A:Z',
      }).then(function(response) {
        var result = {status: "success", spreadsheetId: response.result.spreadsheetId};
        return result;
      }, function(errorResponse) {
        throw errorResponse;
      });
    };
    this.clearSpreadsheet = clearSpreadsheet;

    /**
      * Change the title of a spreadsheet
      */
    var updateSpreadsheetTitle = function(spreadsheetId, spreadsheetTitle) {
      var updateBody = {
        "requests": [
          {
            "updateSpreadsheetProperties": {
              "properties": {"title": spreadsheetTitle},
              "fields": "title"
            }
          }
        ]
      };
      return gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId}, updateBody
      ).then(function(response) {
        var result = {status: "success", spreadsheetId: response.result.spreadsheetId};
        return result;
      }, function(errorResponse) {
        throw errorResponse;
      });
    };
    this.updateSpreadsheetTitle = updateSpreadsheetTitle;


    // Constructor
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://apis.google.com/js/api.js";
    script.onload = function() {
      this.onload=function(){};
      handleGoogleAPILoad();;
    };
    script.onreadystatechange = function() {
      if (this.readyState === 'complete') {
        this.onload();
      }
    };
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
