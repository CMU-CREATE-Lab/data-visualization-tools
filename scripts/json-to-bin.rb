#!/usr/bin/env ruby2.0

load File.dirname(__FILE__) + "/utils.rb"

require 'json'
require 'optparse'
require 'ostruct'

class CustomFormatOptparse
  def self.parse(args)
    # defaults
    options = OpenStruct.new
    options.latKey = "latitude"
    options.lngKey = "longitude"
    options.dateKey = "date"
    options.dateFormat = "unix"

    opt_parser = OptionParser.new do |opts|
      opts.banner = "Usage: custom-format.rb [options]"

      opts.separator ""
      opts.separator "Specific options:"

      opts.on("-f", "--file FILE", "JSON file") do |file|
        options.file = file
      end

      opts.on("--latKey [LATKEY]", "Key for latitude") do |latKey|
        options.latKey = latKey
      end

      opts.on("--lngKey [LNGKEY]", "Key for longitude") do |lngKey|
        options.lngKey = lngKey
      end

      opts.on("--dateKey [DATEKEY]", "Key for date") do |dateKey|
        options.dateKey = dateKey
      end

      opts.on("--dateFormat [DATESTR]", "Date format string") do |dateFormat|
        options.dateFormat = dateFormat
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
  latlonFilename =  File.basename(options.file, ".json") + "_latlon.bin"
  latlonBin = File.open(latlonFilename, 'wb')
  dateFilename =  File.basename(options.file, ".json") + "_date.bin"
  dateBin = File.open(dateFilename, 'wb')  
  data = read_json(options.file)
  data.each do |d|
    latlonBin.write([d[options.latKey].to_f].pack("e"))
    latlonBin.write([d[options.lngKey].to_f].pack("e"))
    if options.dateFormat == "unix"
      dateBin.write([d[options.dateKey].to_i].pack("l<"))
    else
      dateBin.write([DateTime.strptime(d[options.dateKey], options.dateFormat).to_time.to_i].pack("l<"))
    end
  end
  latlonBin.close
  dateBin.close
end

main
  
