#!/usr/bin/env ruby2.0

load File.dirname(__FILE__) + "/../../../capture/libs/utils.rb"

require 'json'
require 'optparse'
require 'ostruct'

class CustomFormatOptparse
  def self.parse(args)
    # defaults
    options = OpenStruct.new

    opt_parser = OptionParser.new do |opts|
      opts.banner = "Usage: custom-format.rb [options]"

      opts.separator ""
      opts.separator "Specific options:"

      opts.on("-f", "--file FILE", "JSON file") do |file|
        options.file = file
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
  filename = File.basename(options.file, ".json") + ".bin"
  bin = File.open(filename, 'wb')
  data = read_json(options.file)
  data.each do |d|
    bin.write([d["latitude"].to_f].pack("e"))    
    bin.write([d["longitude"].to_f].pack("e"))
    bin.write([d["RadiantOutput"].to_f].pack("e"))    
    bin.write([d["RadiativeHeat"].to_f].pack("e"))
    bin.write([d["footprint"].to_f].pack("e"))
    bin.write([d["Temperature"].to_i].pack("l<"))
    bin.write([DateTime.strptime(d["datetime"], '%Y-%m-%d %H:%M:%S%z').to_time.to_i].pack("l<"))
  end
  bin.close
end

main
  
