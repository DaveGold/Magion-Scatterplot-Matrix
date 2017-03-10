//Copyright 2017, by David Golverdingen

//Licensed under the Apache License, Version 2.0 (the "License");
//you may not use this file except in compliance with the License.
//You may obtain a copy of the License at

//http://www.apache.org/licenses/LICENSE-2.0

//Unless required by applicable law or agreed to in writing, software
//distributed under the License is distributed on an "AS IS" BASIS,
//WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//See the License for the specific language governing permissions and
//limitations under the License.

// This symbol depends on scatterplotMatrix.js and that file should be placed in the ext folder

(function (CS) {

    // symbol definition
    var definition = {
        typeName: "scatterplotmatrix",
        displayName: "Magion Scatterplot Matrix",
        // Has to be multiple, otherwise a symbol will be created for each attribute
        datasourceBehavior: CS.Extensibility.Enums.DatasourceBehaviors.Multiple,
        visObjectType: symbolVis,
        getDefaultConfig: function () {
            // Timeseries is not usable for getting evenly spaced data for multiple sources.
            // A multiple data source is still needed to be able to add extra sources but traffic is limited by selecting ModeSingleton.
            return {
                Title: "Magion Scatterplot Matrix",
                DataShape: 'TimeSeries',
                DataQueryMode: CS.Extensibility.Enums.DataQueryMode.ModeSingleton,
                Height: 700,
                Width: 700,
                NumberOfCurrentPoints: 50,
                FilterMultiplier: 1.5,
                RemoveOutliers: false,
                ShowBasicStatistics: false,
                ShowRegression: false,
                ShowPearson: false,
                ShowSpearman: false
            };
        },
        iconUrl: "/Scripts/app/editor/symbols/ext/Icons/Magion.png",
        configTitle: "Format Scatterplot Matrix",
        inject: ["$http", "timeProvider", "$q", "log"]
    };

    function symbolVis() { };
    CS.deriveVisualizationFromBase(symbolVis);

    // Init symbol
    symbolVis.prototype.init = function (scope, elem, $http, timeProvider, $q, log) {

        this.onDataUpdate = dataUpdate;
        this.onConfigChange = configChanged;
        this.onResize = resize;

        var isNotInitialised = true;

        var config = {
            withCredentials: true
        };
        // Make the id of scatterplot div unique
        var id = "scatterMatrix_" + Math.random().toString(36).substr(2, 16);
        var element = document.getElementById("scatterMatrix");
        element.id = id;

        scope.lastMessage = "";
        scope.lastPath = [];
        scope.lastData = [];

        // Data update 
        function dataUpdate(dataUpdate) {
            // Check if update is detailed data or only values
            if (dataUpdate && dataUpdate.Data.length > 0 && dataUpdate.Data[0].Label !== undefined) {
                // Get urls
                var urls = createPIWebAPIurls(dataUpdate.Data);

                // Get direct value links
                getPIWebAPIlinks(urls).then(function (dataLinksArray) {

                    scope.symbol.dataLinksArray = dataLinksArray;

                    // Get data from links
                    getDataFromPIWebAPILinks(dataLinksArray).then(function (data) {
                        scope.lastData = parseAndCheckDataForScatterplot(data);
                        if (scope.lastData.plotData.length >= 4) {
                            createScatterMatrix(scope.lastData, id, scope.config);
                        }
                        else {
                            scope.ErrorMessage = "Dataset to small";
                            logError();
                        }
                    },handleError)

                    isNotInitialised = false;
                },handleError);
            }
                // Only values, just used old data
            else {
                if (!isNotInitialised) {
                    // Get data from links
                    getDataFromPIWebAPILinks(scope.symbol.dataLinksArray).then(function (data) {
                        scope.lastData = parseAndCheckDataForScatterplot(data);
                        if (scope.lastData.plotData.length >= 4) {
                            createScatterMatrix(scope.lastData, id, scope.config);
                        }
                        else {
                            scope.ErrorMessage = "Dataset to small";
                            logError();
                        }
                    },handleError)
                }
            }
        };

        var isChanged = false;

        // Config changed, will also be trigger on first initialization of the symbol
        function configChanged(newConfig, oldConfig) {
            if (!newConfig || !oldConfig || angular.equals(newConfig, oldConfig)) {
                return;
            }            

            // Check interval changed and new data needed
            if (newConfig.NumberOfCurrentPoints !== oldConfig.NumberOfCurrentPoints) {
                if (!isChanged && !isNotInitialised) {
                    // Debounce lots of config changes
                    isChanged = true;
                    setTimeout(function () {
                        // Get data from links
                        getDataFromPIWebAPILinks(scope.symbol.dataLinksArray).then(function (data) {
                            scope.lastData = parseAndCheckDataForScatterplot(data);

                            if (scope.lastData.plotData.length >= 4) {
                                createScatterMatrix(scope.lastData, id, scope.config);
                                isChanged = false;
                            }
                            else {
                                scope.ErrorMessage = "Dataset to small";
                                logError();
                            }
                        },handleError)
                    },500);
                }
            }
            else {
                if (!isNotInitialised) {
                    createScatterMatrix(scope.lastData, id, scope.config);
                }
            }
        };

        // Create PIWebAPI url for PI or AF paths
        function createPIWebAPIurls(dataArray) {

            var urls = [];
            var datasourceArray = scope.symbol.DataSources
            scope.lastPath = [];

            for (var i = 0; i < dataArray.length; i++) {
                // Check for pi or af point
                var url = "";
                if (datasourceArray[i].indexOf("pi:") == 0) {
                    url = CS.ClientSettings.PIWebAPIUrl + "\\points?path=" + dataArray[i].Path;
                }
                else {
                    url = CS.ClientSettings.PIWebAPIUrl + "\\attributes?path=" + dataArray[i].Path;
                }
                urls.push(url);
                scope.lastPath.push(dataArray[i].Path);
            }

            return urls;
        };

        // Resolve every url and get the direct PIWebAPI data links
        function getPIWebAPIlinks(urls) {

            var deferred = $q.defer();

            if (urls.length > 0) {
                // Create data promises
                var dataPromises = [];
                urls.forEach(function (url) {
                    dataPromises.push($http.get(url, config));
                });
                // Resolve data promises
                $q.all(dataPromises).then(function (dataPoints) {
                    var dataLinksArray = [];
                    // Create value promises
                    dataPoints.forEach(function (point, index) {
                        dataLinksArray.push({
                            name: point.data.Name,
                            path: scope.lastPath[index],
                            valueLink: point.data.Links.Value,
                            interpolatedLink: point.data.Links.InterpolatedData
                        });
                    });

                    deferred.resolve(dataLinksArray);

                }, handleError);
            }

            else {
                deferred.reject();
            }

            return deferred.promise;
        };

        // Get data from links
        function getDataFromPIWebAPILinks(dataLinksArray) {

            var deferred = $q.defer();

            if (dataLinksArray.length > 0) {
                // The current time interval is divided by the number of points to show to give the time interval of the interpolated data
                // Use the server side dates to get the interval
                var start = new Date(timeProvider.getServerStartTime());
                var stop = new Date(timeProvider.getServerEndTime());
                var duration = (stop.getTime() - start.getTime()) / 1000; // seconds
                var interval = duration;
                if (+scope.config.NumberOfCurrentPoints !== 1) {
                    interval = duration / (+scope.config.NumberOfCurrentPoints - 1);
                }
                // Query with the coresight start and end date. In "now" modus this will use * for the end date.
                // This will result in a broken interpolation on now, resulting in a "no data" object. 
                var isRealtime = timeProvider.getDisplayEndTime() === "*";
                var queryInterpolated = "?startTime=" + timeProvider.getServerStartTime() + "&endTime=" + timeProvider.getServerEndTime() + "&interval=" + (interval) + "s";

                var dataResult = [];
                var valuePromises = [];
                var interpolatedPromises = [];

                // Create value promises
                dataLinksArray.forEach(function (dataLinks) {
                    dataResult.push({ name: dataLinks.name, path: dataLinks.path, values: [] });
                    valuePromises.push($http.get(dataLinks.valueLink, config));
                    interpolatedPromises.push($http.get(dataLinks.interpolatedLink + queryInterpolated, config));
                });

                // Resolve interpolated promises
                $q.all(interpolatedPromises).then(function (interpolatedData) {
                    // Resolve value promises
                    $q.all(valuePromises).then(function (valueData) {

                        // Replace no data with last value
                        for (var i = 0; i < interpolatedData.length; i++) {
                            var copy = angular.copy(interpolatedData[i].data.Items)
                            if (isRealtime) {
                                copy[copy.length - 1] = angular.copy(valueData[i].data);
                            }
                            dataResult[i].values = copy;
                        }
                        deferred.resolve(dataResult);

                    }, handleError);
                }, handleError);
            }
            else {
                deferred.reject();
            }
            return deferred.promise;

        };

        // Parse data for scatterplot
        function parseAndCheckDataForScatterplot(data) {

            dataSet = {
                plotData: [],
                plotNames: [],
                plotPaths: []
            };

            valuesSet = [];

            data.forEach(function (set) {
                dataSet.plotNames.push(set.name);
                dataSet.plotPaths.push(set.path);
                valuesSet.push(set.values);
            });

            // Create value pairs and add to collection if values are ok
            for (var i = 0; i < valuesSet[0].length; i++) {
                var valueCollection = []
                valuesSet.forEach(function (value) {
                    valueCollection.push(value[i].Value);
                })

                var valuesOk = true;
                valueCollection.forEach(function (value) {
                    if (isNaN(value)) {
                        valuesOk = false;
                    }
                });
                if (valuesOk) {
                    dataSet.plotData.push(valueCollection);
                } 
            }
            return dataSet;
        };

        // Handle errors
        function handleError(error) {            
            scope.ErrorMessage = "";
            if (error.data !== undefined) {
                if (error.data.Errors !== undefined) {
                    error.data.Errors.forEach(function (e) {
                        scope.ErrorMessage += e;
                    });
                    scope.Error = true;
                    logError();
                }
            }
        };

        // Log error message
        function logError() {
            if (scope.ErrorMessage !== scope.lastMessage) {
                scope.lastMessage = scope.ErrorMessage;                
                log.add(scope.config.Title, log.Severity.Error, scope.ErrorMessage);
            }
        }

        var isResized = false;
        // Resize function
        function resize(width, height) {

            if (!isResized) {
                isResized = true;
                setTimeout(function () {
                    isResized = false;

                }, 1000);
            }

            // this triggers a config change
            scope.config.Width = width;
            scope.config.Height = height;
        };
    };

    CS.symbolCatalog.register(definition);

})(window.PIVisualization || window.Coresight);






