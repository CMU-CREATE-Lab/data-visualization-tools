#!/usr/bin/env ruby1.9.1

load File.dirname(__FILE__) + "/utils.rb"

require 'json'
require 'optparse'
require 'ostruct'

class CustomFormatOptparse
  def self.parse(args)
    # defaults
    options = OpenStruct.new
    options.cat = true

    opt_parser = OptionParser.new do |opts|
      opts.banner = "Usage: custom-format.rb [options]"

      opts.separator ""
      opts.separator "Specific options:"

      opts.on("-f", "--file FILE", "JSON file") do |file|
        options.file = file
      end

        # Boolean switch.
      opts.on("-c", "--[no-]cat", "cat into single file") do |c|
        options.cat = c
      end

      
    end

    opt_parser.parse!(args)
    options
  end
end

def main
  options = CustomFormatOptparse.parse(ARGV)
  unless File.exists? options.file
    puts "Could not find or open #{options.file}"
    return
  end
  if options.cat
    filename = File.basename(options.file, ".json") + ".bin"
    bin = File.open(filename, 'wb')
  else
    latlonFilename =  File.basename(options.file, ".json") + "_latlon.bin"
    latlonBin = File.open(latlonFilename, 'wb')

    radiantOutputFilename = File.basename(options.file, ".json") + "_radiant_output.bin"
    radiantOutputBin = File.open(radiantOutputFilename, 'wb')

    radiativeHeatFilename = File.basename(options.file, ".json") + "_radiative_heat.bin"
    radiativeHeatBin = File.open(radiativeHeatFilename, 'wb')

    footprintFilename = File.basename(options.file, ".json") + "_footprint.bin"
    footprintBin = File.open(footprintFilename, 'wb')

    temperatureFilename = File.basename(options.file, ".json") + "_temperature.bin"
    temperatureBin = File.open(temperatureFilename, 'wb')

    datetimeFilename  = File.basename(options.file, ".json") + "_datetime.bin"
    datetimeBin = File.open(datetimeFilename, 'wb')

  end
  data = read_json(options.file)
  data.each do |d|
    if options.cat
      bin.write([d["latitude"].to_f].pack("e"))
      bin.write([d["longitude"].to_f].pack("e"))
      bin.write([d["RadiantOutput"].to_f].pack("e"))
      bin.write([d["RadiativeHeat"].to_f].pack("e"))
      bin.write([d["footprint"].to_f].pack("e"))
      bin.write([d["Temperature"].to_i].pack("l<"))
      bin.write([DateTime.strptime(d["datetime"], '%Y-%m-%d %H:%M:%S%z').to_time.to_i].pack("l<"))
    else
      latlonBin.write([d["latitude"].to_f].pack("e"))
      latlonBin.write([d["longitude"].to_f].pack("e"))
      radiantOutputBin.write([d["RadiantOutput"].to_f].pack("e"))
      radiativeHeatBin.write([d["RadiativeHeat"].to_f].pack("e"))
      footprintBin.write([d["footprint"].to_f].pack("e"))
      temperatureBin.write([d["Temperature"].to_i].pack("l<"))
      datetimeBin.write([DateTime.strptime(d["datetime"], '%Y-%m-%d %H:%M:%S%z').to_time.to_i].pack("l<"))
    end
  end
  if options.cat
    bin.close
  else
    latlonBin.close
    radiantOutputBin.close
    radiativeHeatBin.close
    footprintBin.close
    temperatureBin.close
    datetimeBin.close
  end
end

main
  
