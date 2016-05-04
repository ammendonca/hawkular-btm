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

/// <reference path='dagreD3Plugin.ts'/>
module DagreD3 {
  declare let dagreD3: any;

  export class DagreD3Directive {

    public restrict = 'EA';
    public transclude = false;
    public replace = true;

    //private render = new dagreD3.render();
    public link: (scope, elm, attrs, ctrl) => any;

    constructor(public $compile) {
      // necessary to ensure 'this' is this object <sigh>
      this.link = (scope, elm, attrs, ctrl) => {
        return this.doLink(scope, elm, attrs, ctrl, $compile);
      };
    }

    private doLink(scope, elm, attrs, ctrl, $compile): void {

      // Set up zoom support
      let svg = d3.select('svg'),
        inner = svg.select('g'),
        zoom = d3.behavior.zoom().on('zoom', () => {
          inner.attr('transform', 'translate(' + d3.event.translate + ')' +
            'scale(' + d3.event.scale + ')');
        });
      svg.call(zoom);
      let render = new dagreD3.render();
      let g = new dagreD3.graphlib.Graph();

      function clear() {
        let svg = d3.select('svg > g');
        svg.selectAll('*').remove();
      }

      function draw(isUpdate) {
        g = new dagreD3.graphlib.Graph();
        zoom.scale(1);
        zoom.translate([0, 0]);
        inner.attr('transform', '');
        g.setGraph({
          nodesep: 10,
          ranksep: 50,
          // Left-to-right layout
          rankdir: 'LR',
          marginx: 20,
          marginy: 20
        });

        _.each(scope[attrs.nodes], (d) => {
          let className = d.averageDuration < 500 ? 'success' : 'danger';
          let nodeTooltip = '<strong>Duration</strong> (avg/min/max) <br>' + d.averageDuration;
          nodeTooltip += ' / ' + d.minimumDuration + ' / ' + d.maximumDuration;
          let html = '<div tooltip-append-to-body="true" tooltip-html-unsafe="' + nodeTooltip + '">';
          html += '<span class="status"></span>';
          html += '<span class="node-count pull-right">' + d.count + '</span>';
          html += '<span class="name">' + d.id + '</span>';
          html += '<span class="stats"><span class="duration">Avg. Duration ' + d.averageDuration + 'ms</span></span>';
          html += '</div>';
          g.setNode(d.id, {
            labelType: 'html',
            label: html,
            rx: 5,
            ry: 5,
            padding: 0,
            class: className
          });
          if (!angular.equals({}, d.outbound)) {
            _.each(Object.keys(d.outbound), (nd: any) => {
              let linkTooltip = '<strong>Latency</strong> (avg/min/max) <br>' + d.outbound[nd].averageLatency;
              linkTooltip += ' / ' + d.outbound[nd].minimumLatency + ' / ' + d.outbound[nd].maximumLatency;
              let linkHtml = '<span tooltip-append-to-body="true" tooltip-placement="bottom" tooltip-html-unsafe="';
              linkHtml += linkTooltip + '">' + d.outbound[nd].count + '</span>';
              g.setEdge(d.id, nd, {
                labelType: 'html',
                label: linkHtml,
                class: '',
                width: 40
              });
            });
          }
        });

        let res = inner.call(render, g);
        $compile(res[0])(scope);

        // code for supporting node drag (adapted from http://jsfiddle.net/egfx43hs/11/)

        let safeId = function(id) {
          return id.replace(/[\[|&;$%@"<>()+,/\]]/g, '_');
        };

        //give IDs to each of the nodes so that they can be accessed
        svg.selectAll('g.node rect').attr('id', (d) => {
          return 'node' + safeId(d);
        });
        svg.selectAll('g.edgePath path').attr('id', (e) => {
          return safeId(e.v) + '-' + safeId(e.w);
        });
        svg.selectAll('g.edgeLabel g').attr('id', (e) => {
          return 'label_' + safeId(e.v) + '-' + safeId(e.w);
        });

        g.nodes().forEach((v) => {
          let node = g.node(v);
          node.customId = 'node' + safeId(v);
        });
        g.edges().forEach((e) => {
          let edge = g.edge(e.v, e.w);
          edge.customId = safeId(e.v) + '-' + safeId(e.w);
        });

        let nodeDrag = d3.behavior.drag().on('dragstart', dragstart).on('drag', dragmove);

        let edgeDrag = d3.behavior.drag()
          .on('dragstart', dragstart)
          .on('drag', (d) => {
            translateEdge(g.edge(d.v, d.w), d3.event.dx, d3.event.dy);
            $('#' + g.edge(d.v, d.w).customId).attr('d', calcPoints(d));
          });

        nodeDrag.call(svg.selectAll('g.node'));
        edgeDrag.call(svg.selectAll('g.edgePath'));

        function dragstart(d) {
          d3.event.sourceEvent.stopPropagation();
        }

        function dragmove(d) {
          let node = d3.select(this),
            selectedNode = g.node(d);
          let prevX = selectedNode.x,
            prevY = selectedNode.y;

          selectedNode.x += d3.event.dx;
          selectedNode.y += d3.event.dy;
          node.attr('transform', 'translate(' + selectedNode.x + ',' + selectedNode.y + ')');

          let dx = selectedNode.x - prevX,
            dy = selectedNode.y - prevY;

          g.edges().forEach((e) => {
            if (e.v === d || e.w === d) {
              let edge = g.edge(e.v, e.w);
              translateEdge(g.edge(e.v, e.w), dx, dy);
              $('#' + edge.customId).attr('d', calcPoints(e));
              let label = $('#label_' + edge.customId);
              let xforms = label.attr('transform');
              let parts = /translate\(\s*([^\s,)]+)[ ,]([^\s,)]+)/.exec(xforms);
              let X = parseInt(parts[1], 10) + dx, Y = parseInt(parts[2], 10) + dy;
              label.attr('transform', 'translate(' + X + ',' + Y + ')');
            }
          });
        }

        function translateEdge(e, dx, dy) {
          e.points.forEach((p) => {
            p.x = p.x + dx;
            p.y = p.y + dy;
          });
        }

        // taken from dagre-d3 source code (not the exact same)
        function calcPoints(e) {
          let edge = g.edge(e.v, e.w),
            tail = g.node(e.v),
            head = g.node(e.w);
          let points = edge.points.slice(1, edge.points.length - 1);
          edge.points.slice(1, edge.points.length - 1);
          points.unshift(intersectRect(tail, points[0]));
          points.push(intersectRect(head, points[points.length - 1]));
          return d3.svg.line()
            .x((d) => {
              return d.x;
            })
            .y((d) => {
              return d.y;
            })
            .interpolate('linear')
            (points);
        }

        // taken from dagre-d3 source code (not the exact same)
        function intersectRect(node, point) {
          let x = node.x;
          let y = node.y;
          let dx = point.x - x;
          let dy = point.y - y;
          let w = parseInt($('#' + node.customId).attr('width'), 10) / 2;
          let h = parseInt($('#' + node.customId).attr('height'), 10) / 2;
          let sx = 0,
            sy = 0;
          if (Math.abs(dy) * w > Math.abs(dx) * h) {
            // Intersection is top or bottom of rect.
            if (dy < 0) {
              h = -h;
            }
            sx = dy === 0 ? 0 : h * dx / dy;
            sy = h;
          } else {
            // Intersection is left or right of rect.
            if (dx < 0) {
              w = -w;
            }
            sx = w;
            sy = dx === 0 ? 0 : w * dy / dx;
          }
          return {
            x: x + sx,
            y: y + sy
          };
        }
      }

      scope.$watchCollection('[rootNode, filteredNodes]', function(value) {
        if (value[0] && value[1].length) {
          draw(false);
        } else {
          clear();
        }
      });

    }
  }
}