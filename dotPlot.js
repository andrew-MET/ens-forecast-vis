import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

export class dotPlot {
    constructor(id) {
      this._id = id ? id[0] === "#" ? id : "#" + id : id;
      this._width = 120;
      this._height = 120;
      this._margins = {
        top: 1, 
        right: 5,
        bottom: 20,
        left: 5
      };
      this._utcTime = false;
      this._timeFormat = "%Y-%m-%d %H:%M:%S";
      this._validTimeKey = "validdate";
      this._data = null;
      this._paramKey = null;
      this._dotColours = {
        above: "#C33",
        below: "#33C"
      };
      this._bg = "#FFF";
      this._threshold = null;
      this._step = 1;
      this._forceStep = false;
      this._maxSteps = null;
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
  
    colours(a, b) {
      this._dotColours = {above: a, below: b};
      return this;
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
  
    paramKey(k) {
      this._paramKey = k;
      return this;
    }
  
    data(data) {
      this._data = data;
      this._maxSteps = Math.ceil(data.length / 2);
      return this;
    }
  
    threshold(t) {
      this._threshold = t;
      return this;
    }
  
    step(s) {
      this._step = s;
      return this;
    }
  
    force(f) {
      this._forceStep = f;
      return this;
    }
  
    test() {
      return this._calc();
    }
  
    render() {
      this._drawDots();
      return this;
    }
  
    _calc() {
      let ll = this._maxSteps + 1;
      let step = this._step / 2;
      let thresholds;
      while (ll > this._maxSteps) {
        step = step * 2;
        thresholds = this._dataToThresholds(this._data, step, this._paramKey)
        if (this._forceStep) {
          ll = 0;
        } else {
          ll = thresholds.length
        }
      }

      const thresholdsCache = thresholds;
      const stepCache = step;
      let tooMany = true;
      let res;
      let binMax;
      let count = 0;
      while (tooMany) {
        res = this._makeBinData(this._data, this._paramKey, thresholds, step);
        if (count === 0) {
          binMax = d3.max(d3.groups(res, d => d.x), d => d[1].length)
        }
        if (this._forceStep) {
          tooMany = false;
        } else {
          step = step / 2
          thresholds = this._dataToThresholds(this._data, step, this._paramKey)
          tooMany = d3.groups(res, d => d.x).some(d => d[1].length > this._maxSteps)
          count ++
        }
        if (count == 4) {
          if (d3.max(d3.groups(res, d => d.x), d => d[1].length) === binMax) {
            res = this._makeBinData(this._data, this._paramKey, thresholdsCache, stepCache);
          }
          tooMany = false;
        }
      }
      return res;
    }
  
  
    _dataToThresholds (fcst, step, col) {
      const _roundUp = (value, step) => {
        step || (step = 1.0);
        const inv = 1.0 / step;
        return Math.ceil(value * inv) / inv;
      };
  
      const _roundDown = (value, step) => {
        step || (step = 1.0);
        const inv = 1.0 / step;
        return Math.floor(value * inv) / inv;
      };
  
      const rangeLow = _roundDown(d3.min(fcst, d => d[col]), step);
      const rangeHigh = _roundUp(d3.max(fcst, d => d[col]), step) + step;
      return d3.range(rangeLow, rangeHigh, step);
    }
  
    _makeBinData (fcst, col, thresh, step) {
      const _dataToBins = (data, col, threshes) => {
        const binData = d3
          .bin()
          .value(d => d[col])
          .thresholds(threshes);
        return binData(data);
      };
  
      const _getX = (x0, x1, bin, numBins, binSize) => {
        if (bin < numBins) {
          return x1 - binSize / 2;
        } else {
          return x0 + binSize / 2;
        }
      };
  
      const _sortIndices = arr =>
        Array.from(Array(arr.length).keys()).sort((a, b) =>
          arr[a] < arr[b] ? -1 : (arr[b] < arr[a]) | 0
        );
  
      const _binsToPos = (data, binSize, col, threshold) => {
        let out = [];
        let counter = 0;
  
        for (let i = 0; i < data.length; i++) {
          const sortedIndices = _sortIndices(data[i]);
          data[i] = data[i].sort((x, y) => d3.ascending(x[col], y[col]));
          for (let j = 0; j < data[i].length; j++) {
            out.push({
              x: _getX(data[i].x0, data[i].x1, i + 1, data.length, binSize),
              y: binSize / 2 + j * binSize,
              member: data[i][j].member,
              memberType: data[i][j].member === "mbr000" ? "control" : "perturbed",
              exceed: data[i][j][col] >= threshold ? true : false,
              threshold: threshold,
              symbol: data[i][j].img_code //,
              //colour: data[i][j][colourBy]
            });
            counter++;
          }
        }
  
        return out;
      };
  
      const out = _dataToBins(fcst, col, thresh);
      //return out;
      return _binsToPos(out, step, col, this._threshold);
    }
  
    render () {
  
      const chartData = this._calc()

      const selectOrAppend = (elementType, className, parent) => {
        const selection = parent.select("." + className);
        if (!selection.empty()) return selection;
        return parent.append(elementType).attr("class", className);
      };
  
      const shortestSide = d3.min([
        this._width - this._margins.left - this._margins.right,
        this._height - this._margins.top - this._margins.bottom
      ])
      
      const chartWidth = shortestSide
      const chartHeight = shortestSide
  
      const marginsDot = {
        top: this._margins.top,
        right: this._width - this._margins.left - shortestSide,
        bottom: this._height - this._margins.top - shortestSide,
        left: this._margins.left
      }
  
      const dotPlotsDiv =  d3.select(this._id)
  
      const dotPlots = selectOrAppend("svg", "svg", dotPlotsDiv)
        .attr("width", this._width)
        .attr("height", this._height)
        .node()
  
      const svg = d3.select(dotPlots)
  
      const chart = selectOrAppend("g", "chart", svg).style(
        "transform",
        `translate(${marginsDot.left}px, ${marginsDot.top}px)`
      );
  
      const stepSize = d3.min(chartData, d => d.y) * 2
      const dataSteps = 1 + d3.extent(chartData, d => d.x).reduce((a, b) => b - a) / stepSize
      const maxSteps = this._maxSteps
      const minX = d3.min(chartData, d => d.x) - stepSize * Math.floor((maxSteps - dataSteps) / 2) - stepSize / 2
      const maxX = d3.max(chartData, d => d.x) + stepSize * Math.ceil((maxSteps - dataSteps) / 2) + stepSize / 2
    
  
      const x = d3.scaleLinear()
        .domain([minX, maxX])
        .range([0, chartWidth])
  
      const y = d3.scaleLinear()
        .domain([0, maxSteps * stepSize])
        .range([chartHeight, 0])
  
      const dotRadius = y(0) - y(d3.min(chartData, d => d.y))
  
      const dots = selectOrAppend("g", "dots", chart)
        .selectAll("circle")
        .data(chartData)
        .join("circle")
        .attr("cx", d => x(d.x))
        .attr("cy", d => y(d.y))
        .attr("r", dotRadius)
        .attr("fill", d => d.exceed ? this._dotColours.above : this._dotColours.below)
  
      const xAxis = selectOrAppend("g", "xAxis", chart) 
        .style("font-size", 10)
        .attr("transform", `translate(0, ${chartHeight})`)
        .attr("color", "#999")
        .call(d3.axisBottom(x).scale(x));
  
      return {
        x: [... new Set(chartData.map(d => d.x).sort((a, b) => a - b))],
        xlim: d3.extent(chartData, d => d.x),
        stepSize: stepSize,
        nsteps: dataSteps,
        minX: minX, 
        maxX: maxX,
        test: 1 + ((maxX - stepSize / 2) - (minX + stepSize / 2)) / stepSize,
        radius: dotRadius,
        dim: shortestSide,
        mar: marginsDot
      }
  
    }
  }
  