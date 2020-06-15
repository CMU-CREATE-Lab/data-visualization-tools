export class GSheet {
    file_id: string;
    gid: string;
  
    constructor(file_id: string, gid: string = null) {
      this.file_id = file_id;
      this.gid = gid;
    }
  
    static from_file_id_gid(file_id_gid: string) {
      var split = file_id_gid.split('.', 2);
      if (split.length == 1) return new GSheet(split[0]);
      if (split.length == 2) return new GSheet(split[0], split[1]);
      throw Error('unparsable file_id_gid "${file_id_gid}"')
    }
  
    static from_url(url: string) {
      var regex = /https?:\/\/docs\.google\.com\/spreadsheets\/d\/(\w+)\/(.*gid=(\d+))?/;
      var match = url.match(regex);
      if (!match) {
        throw Error(`url ${url} does not match regex ${regex}, aborting`)
      }
      return new GSheet(match[1], match[3])
    }
  
    file_id_gid() {
      var ret = this.file_id;
      if (this.gid) ret += '.' + this.gid;
      return ret;
    }
  
    url() {
      var ret = `https://docs.google.com/spreadsheets/d/${this.file_id}/edit`;
      if (this.gid) ret += `#gid=${this.gid}`;
      return ret;
    }
  
    get_csv_export_url() {
      var ret = `https://docs.google.com/spreadsheets/d/${this.file_id}/export?format=csv`
      if (this.gid) ret += `&gid=${this.gid}`;
      return ret;
    }
      
    async read_csv(): Promise<[{}]> {
      // @ts-ignore
      var parse = Papa.parse;
      return new Promise(resolve => parse(this.get_csv_export_url(), {
        download: true,
        header: true,
        complete: result => resolve(result.data)
      }));
    }
  }
  