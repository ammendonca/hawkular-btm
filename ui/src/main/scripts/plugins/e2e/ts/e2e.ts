///
/// Copyright 2015-2016 Red Hat, Inc. and/or its affiliates
/// and other contributors as indicated by the @author tags.
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///    http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.
///

/// <reference path="e2ePlugin.ts"/>
module E2E {

  declare let dagreD3: any;

  export let E2EController = _module.controller('E2E.E2EController', ['$scope', '$rootScope', '$routeParams', '$http',
    '$location', '$interval', '$timeout', '$modal', ($scope, $rootScope, $routeParams, $http, $location, $interval,
    $timeout, $modal) => {

    $scope.reload = function() {

      $rootScope.updateCriteriaTimeSpan();

      let commPromise = $http.post('/hawkular/apm/analytics/communication/summary?tree=true',
                                   $rootScope.sbFilter.criteria);
      commPromise.then(function(resp) {
        $scope.e2eData = resp.data;
        $scope.findTopLevels();
        $scope.rootNode = _.indexOf($scope.topLevel, $scope.rootNode) > -1 ? $scope.rootNode : _.first($scope.topLevel);
        $scope.filterByTopLevel($scope.rootNode, true);
      }, function(resp) {
        console.log('Failed to get end-to-end data: ' + JSON.stringify(resp));
      });

      // this informs the sidebar directive, so it'll update it's data as well
      $scope.$broadcast('dataUpdated');
    };

    $rootScope.$watch('sbFilter.customStartTime', $scope.reload);
    $rootScope.$watch('sbFilter.customEndTime', $scope.reload);

    let refreshPromise = $interval(() => { $scope.reload(); }, 10000);
    $scope.$on('$destroy', () => { $interval.cancel(refreshPromise); });

    $rootScope.$watch('sbFilter.criteria', $scope.reload, true);

    // get top level nodes
    $scope.findTopLevels = function() {
      $scope.topLevel = [];
      _.each($scope.e2eData, (node) => {
        $scope.topLevel.push(node.id);
      });
    };

    $scope.addPropertyToFilter = function(pName, pValue, operator) {
      let newProp = {name: pName, value: pValue, operator: operator};
      $rootScope.sbFilter.criteria.properties.push(newProp);
      delete $scope.selPropValue;
    };

    $scope.remPropertyFromFilter = function(property) {
      $rootScope.sbFilter.criteria.properties.splice($rootScope.sbFilter.criteria.properties.indexOf(property), 1);
    };

    $scope.addFaultToFilter = function(fault, operator) {
      $rootScope.sbFilter.criteria.faults.push({value: fault, operator: operator});
    };

    $scope.remFaultFromFilter = function(fault) {
      $rootScope.sbFilter.criteria.faults.splice($rootScope.sbFilter.criteria.faults.indexOf(fault), 1);
    };

    $scope.toggleExcludeInclude = function(propOrFault) {
      if (propOrFault.operator === undefined || propOrFault.operator === 'HAS') {
        propOrFault.operator = 'HASNOT';
      } else if (propOrFault.operator === 'HASNOT') {
        propOrFault.operator = 'HAS';
      }
    };

    $scope.filterByTopLevel = function(nodeId) {
      if (nodeId) {
        let branch = _.find($scope.e2eData, (node: any) => {
          return node.id === nodeId;
        });
        $scope.filteredNodes = branch ? [branch] : [];
      }
    };

    let ModalInstanceCtrl = function ($scope, $modalInstance, $log, rootNode) {

      $scope.rootNode = {
        'uri': rootNode
      };

      let instDetails = $http.post('/hawkular/apm/analytics/trace/completion/times',
                                   $rootScope.sbFilter.criteria);

      instDetails.then(function(resp) {
        $scope.timesData = resp.data;
      });

      $scope.sortKey = 'timestamp';
      $scope.reverse = false;

      $scope.sort = function(keyname) {
        $scope.sortKey = keyname; // set the sortKey to the param passed
        $scope.reverse = !$scope.reverse; // if true make it false and vice versa
      };

      $scope.durationRange = function (entry) {
        return entry.duration >= ($scope.minDuration || 0) &&
          entry.duration <= ($scope.maxDuration || Number.MAX_VALUE);
      };

      $scope.close = function() {
        $modalInstance.dismiss('cancel');
      };
    };

    $scope.showInstanceDetails = function() {
      $modal.open({
        templateUrl: 'plugins/e2e/html/details-modal.html',
        controller: ModalInstanceCtrl,
        size: 'lg',
        resolve: {
          rootNode: function () {
            console.log($scope.rootNode);
            return $scope.rootNode;
          }
        }
      });
    };

    $scope.resetZoom = function() {
      // we just re-draw it, by re-selecting root node
      let oldRootNode = $scope.rootNode;
      $scope.rootNode = '';
      $timeout(() => {
        $scope.rootNode = oldRootNode;
      });
    };

  }]);

}
