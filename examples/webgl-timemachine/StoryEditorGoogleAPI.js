// Client ID and API key from the Developer Console
var CLIENT_ID = '469566611033-9qaggmqhgangl8tcddkijk2tuvhufv0q.apps.googleusercontent.com';
// Array of API discovery doc URLs for APIs used by the quickstart
var DISCOVERY_DOCS = ["https://sheets.googleapis.com/$discovery/rest?version=v4", "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
// Authorization scopes required by the API; multiple scopes can be included, separated by spaces.
var SCOPES = "https://www.googleapis.com/auth/drive.file";

var tmpListeners = [];

/**
 *  Load the auth2 library and API client library.
 */
function handleGoogleAPILoad() {
  gapi.load('client:auth2', initClient);
}

function isAuthenticatedWithGoogle() {
  var authInstance = gapi.auth2.getAuthInstance();
  var isAuthenticated = false;
  if (authInstance) {
    isAuthenticated = authInstance.isSignedIn.get();
  }
  return isAuthenticated;
}

function addGoogleSignedInStateChangeListener(listener) {
  if (gapi && gapi.auth2 && gapi.auth2.getAuthInstance()) {
    gapi.auth2.getAuthInstance().isSignedIn.listen(listener);
  } else {
    tmpListeners.push(listener);
  }
}

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
 *  Sign in the user upon button click.
 */
function handleAuthClick(event) {
  gapi.auth2.getAuthInstance().signIn();
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick(event) {
  gapi.auth2.getAuthInstance().signOut();
}

/**
 * List all the spreadsheets from Drive of an authenticated user
 */
function listSpreadsheets() {
  return gapi.client.drive.files.list({
    'pageSize': 1000,
    'fields': "nextPageToken, files(id, name)",
    'q': "(mimeType='application/vnd.google-apps.spreadsheet')",
  }).then(function(response) {
    return response.result.files;
  });
}

/**
  * Make a file publicly viewable on Drive
  */
function makeFilePublicViewable(fileId) {
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
}

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
function createEmptySpreadsheet(spreadsheetTitle) {
  spreadsheetTitle = spreadsheetTitle ? spreadsheetTitle : "EarthTime Waypoints - " + (new Date()).getTime();
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
}

/**
  * Create a spreadsheet and write content to it
  */
function createNewSpreadsheetWithContent(spreadsheetTitle, content) {
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
}

/**
  * Change the formatting of the cells in a spreadsheet
  * In this case, make the top row fixed and its content bold and all cells to be left aligned and content clipped
  */
function formatCellsInSpreadsheet(spreadsheetId) {
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
}

/**
  * Read the contents of a specific spreadsheet based on its ID
  * UNUSED: It is left here as an API call example but in the context
  * of the story editor, this specific function is not used and potentially bitrotted.
  */
function readSpreadsheet(spreadsheetId) {
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
}

/**
  * Update the contents of spreadsheet by first clearing out all the values and then writing new ones
  * If a new title is provided, update that as well.
  */
function updateSpreadsheet(spreadsheetId, content, newTitle) {
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
}

/**
  * Write out content to a spreadsheet
  */
function writeContentToSpreadsheet(spreadsheetId, content) {
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
}

/**
  * Clear out the contents of a spreadsheet
  */
function clearSpreadsheet(spreadsheetId) {
  return gapi.client.sheets.spreadsheets.values.clear({
    spreadsheetId: spreadsheetId,
    range: 'A:Z',
  }).then(function(response) {
    var result = {status: "success", spreadsheetId: response.result.spreadsheetId};
    return result;
  }, function(errorResponse) {
    throw errorResponse;
  });
}

/**
  * Change the title of a spreadsheet
  */
function updateSpreadsheetTitle(spreadsheetId, spreadsheetTitle) {
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
}
