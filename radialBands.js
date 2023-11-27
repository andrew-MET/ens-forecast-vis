import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

export class radialBands {
  constructor(parent) {
    this._parent = parent;
    this._width = 800;
    this._height = 400;
    this._margins = {
      top: 10,
      right: 30,
      bottom: 30,
      left: 30
    };
    this._utcTime = false;
    this._timeFormat = "%Y-%m-%d %H:%M:%S";
    this._validTimeKey = "valid_dttm";
    this._data = null;
    this._paramKey = null;
    this._paramUnit = "";
    this._bandColours = {
      q100q0: d3.interpolateOranges(0.2),
      q90q10: d3.interpolateOranges(0.5),
      q75q25: d3.interpolateOranges(0.8)
    };
    this._bandWidths = {
      q100q0: 10,
      q90q10: 16,
      q75q25: 22
    };
    this._bg = "#FFF";
    this._minY = null;
    this._maxY = null;
    this._textColour = "#000";
    this._testVal = null;
    this._threshold = null;
    this._binStep = 1;
    this._forceStep = false;
  }

  size(w, h) {
    this._width = w;
    this._height = h;
    return this;
  }

  margins(t, r, b, l) {
    this._margins = { top: t, right: r, bottom: b, left: l };
    return this;
  }

  colours(q100q0, q90q10, q75q25) {
    this._bandColours = {
      q100q0: q100q0,
      q90q10: q90q10,
      q75q25: q75q25
    };
    return this;
  }

  bandWidths(q100q0, q90q10, q75q25) {
    this._bandWidths = {
      q100q0: q100q0,
      q90q10: q90q10,
      q75q25: q75q25
    };
  }

  bg(c) {
    this._bg = c;
    return this;
  }

  textColour(c) {
    this._textColour = c;
    return this;
  }

  utcTime(utc) {
    this._utcTime = utc;
    return this;
  }

  timeFormat(t) {
    this._timeFormat = t;
    return this;
  }

  validTimeKey(k) {
    this._validTimeKey = k;
    return this;
  }

  data(data) {
    this._data = data;
    return this;
  }

  threshold(t) {
    this._threshold = t;
    return this;
  }

  binSize(b) {
    this._binStep = b;
    return this;
  }
  forceBinSize(f) {
    this._forceStep = f;
    return this;
  }

  paramKey(k) {
    this._paramKey = k;
    return this;
  }

  paramUnit(u) {
    this._paramUnit = u;
    return this;
  }

  ylim(l, h) {
    const yLims = [l, h].sort();
    this._minY = yLims[0];
    this._maxY = yLims[1];
    return this;
  }

  test() {
    this._testVal = {
      quadrants: this._toQuadrants(),
      quantiles: this._toQuantiles(),
      bands: this._toBands()
    };
    //this._testVal = this._toDays();
    return this;
  }

  render() {
    const intervalId = this._drawBands();
    this.intervalId = intervalId;
    return this;
  }

  //

  _toQuadrants() {
    let data = this._data.map((d) => ({
      ...d,
      quadrant:
        d[this._paramKey] >= 0 && d[this._paramKey] < 90
          ? 1
          : d[this._paramKey] >= 90 && d[this._paramKey] < 180
            ? 2
            : d[this._paramKey] >= 180 && d[this._paramKey] < 270
              ? 3
              : 4
    }));
    const range = (data, key) => {
      const extent = d3.extent(data.map((d) => d[key]));
      return extent[1] - extent[0];
    };
    const quadrants = [...new Set(data.map((d) => d.quadrant))].sort();

    if (
      d3.intersection(quadrants, [1, 4]).size === 2 ||
      d3.intersection(quadrants, [1, 2, 4]).size === 3
    ) {
      data = data.map((d) =>
        d.quadrant === 4 ? { ...d, offset: -360 } : { ...d, offset: 0 }
      );
    } else if (d3.intersection(quadrants, [1, 3, 4]).size === 3) {
      data = data.map((d) =>
        d.quadrant === 1 ? { ...d, offset: 360 } : { ...d, offset: 0 }
      );
    } else if (d3.intersection(quadrants, [2, 4]).size === 2) {
      range(data) > 180
        ? (data = data.map((d) =>
          d.quadrant === 4 ? { ...d, offset: -360 } : { ...d, offset: 0 }
        ))
        : (data = data.map((d) => ({ ...d, offset: 0 })));
    } else {
      data = data.map((d) => ({ ...d, offset: 0 }));
    }
    return data;
  }

  _toQuantiles() {
    const data = this._toQuadrants();
    return d3.flatRollup(
      data,
      (v) => ({
        q100: d3.max(v.map((d) => d[this._paramKey] + d.offset)),
        q90: d3.quantile(
          v.map((d) => d[this._paramKey] + d.offset),
          0.9
        ),
        q75: d3.quantile(
          v.map((d) => d[this._paramKey] + d.offset),
          0.75
        ),
        q25: d3.quantile(
          v.map((d) => d[this._paramKey] + d.offset),
          0.25
        ),
        q10: d3.quantile(
          v.map((d) => d[this._paramKey] + d.offset),
          0.1
        ),
        q0: d3.min(v.map((d) => d[this._paramKey] + d.offset)),
        mean: d3.mean(v.map((d) => d[this._paramKey] + d.offset)),
        control: v.filter((d) => d.member === "mbr000")[0][this._paramKey],
        prob: d3.mean(
          v.map((d) => (d[this._paramKey] >= this._threshold ? 1 : 0))
        )
      }),
      (d) => d[this._validTimeKey]
    );
  }

  _toBands() {
    const quantileData = this._toQuantiles();
    return d3
      .groups(
        quantileData
          .map((d) => ({
            time: d[0],
            max: d[1].q100,
            min: d[1].q90,
            range: "q100q0"
          }))
          .concat(
            quantileData.map((d) => ({
              time: d[0],
              max: d[1].q90,
              min: d[1].q75,
              range: "q90q10"
            }))
          )
          .concat(
            quantileData.map((d) => ({
              time: d[0],
              max: d[1].q75,
              min: d[1].q25,
              range: "q75q25"
            }))
          )
          .concat(
            quantileData.map((d) => ({
              time: d[0],
              max: d[1].q25,
              min: d[1].q10,
              range: "q90q10"
            }))
          )
          .concat(
            quantileData.map((d) => ({
              time: d[0],
              max: d[1].q10,
              min: d[1].q0,
              range: "q100q0"
            }))
          ),
        (d) => d.range
      )
      .map((d) => d[1])
      .flat();
  }

  _toDays() {
    return [
      ...new Set(
        this._data
          .filter(
            (d) =>
              d3.utcFormat("%H")(this._timeParser(d[this._validTimeKey])) ==
              "00"
          )
          .map((d) => d[this._validTimeKey])
      )
    ].map((d) => ({
      data: [
        { time: this._timeParser(d), y: 0 },
        {
          time: this._timeParser(d),
          y: this._height - this._margins.bottom - this._margins.top
        }
      ],
      text: d3.utcFormat("%a %d %b")(this._timeParser(d))
    }));
  }

  _timeParser(t) {
    return this._utcTime
      ? d3.utcParse(this._timeFormat)(t)
      : d3.timeParse(this._timeFormat)(t);
  }

  _drawBands() {

    this._parent.style("background-color", `${this._bg}`);

    const selectOrAppend = (elementType, className, parent) => {
      const selection = parent.select("." + className);
      if (!selection.empty()) return selection;
      return parent.append(elementType).attr("class", className);
    };

    const x = d3
      .scaleTime()
      .domain(
        d3.extent(
          this._data.map((d) => this._timeParser(d[this._validTimeKey]))
        )
      )
      .range([0, this._width - this._margins.left - this._margins.right]);

    const minY = this._minY
      ? this._minY
      : d3.min(this._data, (d) => d[this._paramKey]);
    const maxY = this._maxY
      ? this._maxY
      : d3.max(this._data, (d) => d[this._paramKey]);

    const y = d3
      .scaleLinear()
      .domain([minY, maxY])
      .range([this._height - this._margins.bottom - this._margins.top, 0])
      .nice();

    const dayLineGenerator = d3
      .line()
      .x((d) => x(d.time))
      .y((d) => d.y);

    const chartWidth = this._width - this._margins.left - this._margins.right;
    const chartHeight = this._height - this._margins.bottom - this._margins.top;
    const bounds = selectOrAppend("g", "bounds", this._parent).attr(
      "transform",
      `translate(${this._margins.left + chartWidth / 2},${this._margins.top + chartHeight / 2})`
    );

    const bandData = this._toBands();
    const radius = Math.min(chartHeight / 2, chartWidth / 2) - d3.max(Object.values(this._bandWidths)) / 2;

    const outline = selectOrAppend("g", "outline", bounds)
      .selectAll("path")
      .data([{ a1: 0, a2: 2 * Math.PI, ir: radius - 1, or: radius + 1 }])
      .join("path")
      .attr("d", (d) =>
        d3.arc()({
          innerRadius: d.ir,
          outerRadius: d.or,
          startAngle: d.a1,
          endAngle: d.a2
        })
      )
      .attr("stroke", this._textColour)
      .attr("fill", "none");

    const directionsData = [
      [0, [{ x: 0, y: 0 }, { x: 0, y: (radius - 1) }]],
      [
        45,
        [
          { x: 0, y: 0 },
          {
            x: Math.sin(45 * Math.PI / 180) * (radius - 1),
            y: Math.cos(45 * Math.PI / 180) * radius
          }
        ]
      ],
      [90, [{ x: 0, y: 0 }, { x: radius, y: 0 }]],
      [
        135,
        [
          { x: 0, y: 0 },
          {
            x: Math.sin(135 * Math.PI / 180) * (radius - 1),
            y: Math.cos(135 * Math.PI / 180) * (radius - 1)
          }
        ]
      ],
      [180, [{ x: 0, y: 0 }, { x: 0, y: -(radius - 1) }]],
      [
        225,
        [
          { x: 0, y: 0 },
          {
            x: Math.sin(225 * Math.PI / 180) * (radius - 1),
            y: Math.cos(225 * Math.PI / 180) * (radius - 1)
          }
        ]
      ],
      [270, [{ x: 0, y: 0 }, { x: -(radius - 1), y: 0 }]],
      [
        315,
        [
          { x: 0, y: 0 },
          {
            x: Math.sin(315 * Math.PI / 180) * (radius - 1),
            y: Math.cos(315 * Math.PI / 180) * (radius - 1)
          }
        ]
      ]
    ]

    const lineGenerator = d3.line().x(d => d.x).y(d => d.y)

    const directionsLines = selectOrAppend("g", "directionsLines", bounds)
      .selectAll("path")
      .data(directionsData)
      .join("path")
      .attr("d", d => lineGenerator(d[1]))
      .attr("stroke", this._textColour)
      .attr("stroke-dasharray", "4")
      .attr("fill", "none")



    const needlePath = [
      { x: radius * 0.05, y: radius * 0.1 },
      { x: radius * 0.05, y: -radius * 0.9 },
      { x: radius * 0.075, y: -radius * 0.85 },
      { x: 0, y: -radius },
      { x: -radius * 0.075, y: -radius * 0.85 },
      { x: -radius * 0.05, y: -radius * 0.9 },
      { x: -radius * 0.05, y: radius * 0.1 },
      { x: -radius * 0.075, y: radius * 0.15 },
      { x: 0, y: radius * 0.1 },
      { x: radius * 0.075, y: radius * 0.15 },
      { x: radius * 0.05, y: radius * 0.1 }
    ]

    const bands = selectOrAppend("g", "bands", bounds)
      .selectAll("path")
      .data(bandData)
      .join("path")
      .attr("d", (d) =>
        d3.arc()({
          innerRadius: radius - this._bandWidths[d.range] / 2,
          outerRadius: radius + this._bandWidths[d.range] / 2,
          startAngle: (d.max * Math.PI) / 180,
          endAngle: (d.min * Math.PI) / 180
        })
      )
      .attr("fill", (d) => this._bandColours[d.range]);

    const drawNeedle = (angle1, angle2) => {
      const needle = selectOrAppend("g", "needle", bounds)
      needle.transition()
      needle
        .selectAll(".movingNeedle")
        .remove()
      needle
        .append("path")
        .attr("class", "movingNeedle")
        .datum(needlePath)
        .attr("d", lineGenerator)
        .attr("transform", `rotate(${angle1})`)
        .attr("stroke", this._textColour)
        .attr("fill", "none")
        .transition()
        .delay(500)
        .duration(250)
        .attr("transform", `rotate(${angle2})`)
    }

    let counter = 0;
    let i = 0
    const intervalId = setInterval(() => {
      let first = counter;
      counter++;
      if (counter > (this._data.length - 1)) counter = 0;
      const second = counter;
      drawNeedle(this._data[first][this._paramKey], this._data[second][this._paramKey])
    }, 750)

    return intervalId;  

  }
}