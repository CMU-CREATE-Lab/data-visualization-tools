var perf_last_frame_time = 0;
var perf_frame_count = 0;

var perf_stats = {};

function perf_drawframe() {
    var now = new Date().getTime();
    perf_frame_count += 1;
    perf_last_frame_time = now;
}

function perf_avg(name, val) {
    if (!perf_stats.hasOwnProperty(name)) {
	perf_stats[name] = [0, 0];
    }
    perf_stats[name][0] += val;
    perf_stats[name][1] += 1;
}

function perf_sum_per_second(name, val) {
    if (!perf_stats.hasOwnProperty(name)) {
	perf_stats[name] = [0, 'second'];
    }
    perf_stats[name][0] += val;
}

function perf_sum_per_frame(name, val) {
    if (!perf_stats.hasOwnProperty(name)) {
	perf_stats[name] = [0, 'frame'];
    }
    perf_stats[name][0] += val;
}

function perf_receive(nbytes, elapsed_ms) {
    perf_sum_per_second('RecvMbit', nbytes * 8 / 1000000);
    perf_avg('RecvAvgMs', elapsed_ms);
}

function perf_draw_points(n) {
    perf_sum_per_frame('Kpoints', n / 1000);
}

function perf_draw_lines(n) {
    perf_sum_per_frame('Klines', n / 1000);
}

function perf_draw_triangles(n) {
    perf_sum_per_frame('Ktriangles', n / 1000);
}

function perf_get_div() {
    if (!$('#perf').length) {
	$('body').append('<div id="perf" style="position:absolute;right:0;bottom:0;width:100px;height:40px;color:white;background-color:black;z-index:1000000;font-size:9px">');
	$('#perf').hide();
    }
    return $('#perf');
}

function perf_round(x) {
    return Math.round(x * 10) / 10;
}

function perf_update() {
    $('#perf').empty();
    $('#perf').append(perf_frame_count / 1.0 + ' FPS<br>');
    for (var property in perf_stats) {
	if (perf_stats.hasOwnProperty(property)) {
	    var stat = perf_stats[property];
	    var line = property + ': ';
	    if (stat[1] == 'second') {
		line += perf_round(perf_stats[property][0] / 1.0) + '/sec';
	    } else if (stat[1] == 'frame') {
		line += perf_round(perf_stats[property][0] / perf_frame_count) + '/frame';
	    } else {
		line += perf_round(perf_stats[property][0] / perf_stats[property][1]);
	    }
            $('#perf').append(line + '<br>');
 	}
    }

    perf_stats = {};
    perf_frame_count = 0;
    setTimeout(perf_update, 1000);

}

function perf_init() {
    $("body").on("keydown", function(evt) {
        if (evt.ctrlKey && evt.key == 'f') {
            perf_get_div().toggle();
        }

    });
    /*$('body').keypress(function(evt) {
	if (evt.which == 6) { // ctrl-f for FPS
        console.log('perf keypress')
	    perf_get_div().toggle();
	}
    });*/
    setTimeout(perf_update, 1000);
}

console.log('perf.js:  Type ctrl-f to display FPS and other stats')
$(perf_init);
