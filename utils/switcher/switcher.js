import runSimulation from './run-simulation';
import displayTimeline from './display-timeline';
import Config from '../../src/config';

// a dynamic number of time-bandwidth pairs may be defined to drive the simulation
let networkTimeline = document.querySelector('.network-timeline');
let fileNetworkTrace = [];
let $ = document.querySelector.bind(document);

// apply any simulation parameters that were set in the fragment identifier
if (window.location.hash) {
  // time periods are specified as t<seconds>=<bitrate>
  // e.g. #t15=450560&t150=65530
  let params = window.location.hash.substring(1)
    .split('&')
    .map(function(param) {
      return ((/t(\d+)=(\d+)/i).exec(param) || [])
        .map(window.parseFloat).slice(1);
    }).filter(function(pair) {
      return pair.length === 2;
    });

  networkTimeline.innerHTML = '';
}

// collect the simulation parameters
const parameters = function() {
  let networkTrace = $('#network-trace').value
    .trim()
    .split('\n')
    .map((line) => line.split(' ').slice(-2).map(Number));
  let playlists = $('#bitrates').value
    .trim()
    .split('\n')
    .map((line) => {
      let t = line.split(/[,\s]+/).map(Number);
      return [t[0], t[1] || t[0]];
    });

  let segments = {};
  try {
    segments = JSON.parse($('#segments').value);
  } catch(e) {
    console.log('Invalid JSON');
  }

  let goalBufferLength = Math.max(1, Number($('#goal-buffer-length').value));
  let bandwidthVariance = Math.max(0.1, Number($('#bandwidth-variance').value));

  return {
    goalBufferLength,
    bandwidthVariance,
    playlists,
    segments,
    networkTrace
  };
};

let local = $('#local');
// clear the file path to allow for reload
local.addEventListener('click', () => local.value = '');
local.addEventListener('change', function() {
  $('#network-trace').style.display = 'none';
  const files = local.files;

  // do nothing if no file was chosen
  if (!files) {
    return;
  }

  for(var i = 0; i < files.length; i++) {
    const reader = new FileReader();

    reader.addEventListener('loadend', function() {
      fileNetworkTrace += reader.result;
    });

    reader.readAsText(files[i]);
  }
});

let saveReport = $('#save-report');
saveReport.addEventListener('click', function(){
  const result = $('#result').value;
  const data = new Blob([result], {type: 'text/plain'});

  let textFile = window.URL.createObjectURL(data);

  let link = document.createElement('a');
  link.setAttribute('download', 'report.json');
  link.href = textFile;
  document.body.appendChild(link);

  window.requestAnimationFrame(function () {
    let event = new MouseEvent('click');
    link.dispatchEvent(event);
    document.body.removeChild(link);
    window.URL.revokeObjectURL(textFile);
  });
});

let runButton = document.getElementById('run-simulation');
runButton.addEventListener('click', function() {
  runSimulation(parameters(), function(err, res) {
    const report = {
      segments: res.playlists.length,
      timeToStart: res.buffered.find(({buffered}) => buffered).time,
      timeouts: res.playlists.filter(({timedout}) => timedout).length,
      aborts: res.playlists.filter(({aborted}) => aborted).length,
      calculatedBandwidth: res.effectiveBandwidth,
      selectedBitrates: res.playlists.map(({bitrate}) => bitrate),
      bufferEmpty: res.buffered.reduce(function(result, sample, index) {
        var last = result[result.length - 1];

        if (sample.buffered === 0) {
          if (last && last.index === index - 1) {
            // add this sample to the interval we're accumulating
            last.end = sample.time;
            last.index = index;
          } else {
            // this sample starts a new interval
            result.push({
              start: sample.time,
              end: sample.time,
              index: index
            });
          }
        }
        // filter out time periods where the buffer isn't empty
        return result;
      }, []).map(({start, end}) => ({start, end}))
    };

    $('#result').innerText = JSON.stringify(report, null, 2);

    displayTimeline(err, res);
  });
});

runButton.click();

export default fileNetworkTrace;
