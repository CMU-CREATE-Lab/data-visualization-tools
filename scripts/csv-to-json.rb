#!/usr/bin/env ruby1.9.1
require 'csv'
require 'json'
require 'optparse'
require 'ostruct'

load File.dirname(__FILE__) + "/utils.rb"

class CustomFormatOptparse
  def self.parse(args)
    # defaults
    options = OpenStruct.new

    opt_parser = OptionParser.new do |opts|
      opts.banner = "Usage: custom-format.rb [options]"

      opts.separator ""
      opts.separator "Specific options:"

      opts.on("-f", "--file FILE", "CSV file") do |file|
        options.file = file
      end

      opts.on("-s", "--sort KEY", "KEY to sort by") do |sort_by|
        options.sort_by = sort_by
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
  f = File.open(options.file)
  hashes = csv_to_hashes f
  if options.sort_by
    sorted_hashes = hashes.sort_by { |record| record[options.sort_by] }
    hashes = sorted_hashes
  end
  f.close
  filename = File.basename(options.file, ".csv") + ".json"
  f = File.open(filename, "w")
  f.write(hashes.to_json)
  f.close
end

main
  
