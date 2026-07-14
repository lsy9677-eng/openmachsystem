export class LocalRepository{
  async save(state){return state;}
  async load(){return null;}
}
export class LegacyBridge{
  static detect(){
    try{return !!(window.opener&&window.opener.G);}catch{return false;}
  }
  static readLegacySnapshot(){
    if(!this.detect()) throw new Error('연결된 기존 앱 창이 없습니다.');
    return JSON.parse(JSON.stringify(window.opener.G));
  }
}
// Firebase 연동은 기존 앱의 데이터 계약을 확정한 뒤 이 인터페이스에 구현합니다.
export class FirebaseRepository{
  async save(){throw new Error('FirebaseRepository는 아직 운영 경로에 연결되지 않았습니다.');}
  async load(){throw new Error('FirebaseRepository는 아직 운영 경로에 연결되지 않았습니다.');}
}
