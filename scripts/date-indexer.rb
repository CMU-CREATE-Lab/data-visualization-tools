#!/usr/bin/env ruby2.0
require 'optparse'
require 'ostruct'

class CustomFormatOptparse
  def self.parse(args)
    # defaults
    options = OpenStruct.new
    options.span = false

    opt_parser = OptionParser.new do |opts|
      opts.banner = "Usage: custom-format.rb [options]"

      opts.separator ""
      opts.separator "Specific options:"

      opts.on("-f", "--files f1,f2,f3", Array, "List of binary files in order") do |files|
        options.files = files
      end

      opts.on("-s", "--span [TIMESPAN]", "Group events by time span") do |timeSpan|
        options.span = true
        options.timeSpan = timeSpan.to_i
      end
    end

    opt_parser.parse!(args)
    options
  end
end

def main
  obj = {}
  options = CustomFormatOptparse.parse(ARGV)
  options.files.each do |file|
    unless File.exists? file
      puts "Could not find or open #{file}"
      return
    end
    puts "Reading #{file}"
    f = File.open(file)
    while day = f.read(4)
      day = day.unpack("l<")[0]
      if options.span
        dayKey = (day/options.timeSpan) * options.timeSpan
      else
        dayKey = day
      end 
      if obj[dayKey].nil?
        obj[dayKey] = 1
      else
        obj[dayKey] += 1
      end
    end
    f.close
  end
  puts "Total days:   #{obj.keys.length}"
  puts "Total events: #{obj.values.inject(0) {|a,b| a+b}}"
  keys = obj.keys.sort
  filename = "#{keys.first}-#{keys.last}_index.bin"
  puts "Saving to #{filename}"
  f = File.open(filename, 'wb')
  index = 0
  keys.each do |key|
    f.write([key].pack("l<"))
    f.write([obj[key]].pack("l<"))
    f.write([index].pack("l<"))
    index += obj[key]
  end
  f.close
end

main
  
