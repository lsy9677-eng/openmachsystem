// 230MATCH stable module · notice-links.js · 5.10.0
export function noticeBodyHtml(value){
  const esc=String(value??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  const linked=esc.replace(/https?:\/\/[^\s<]+/gi,(url)=>{
    let href=url,trail='';
    while(/[),.!?;:]$/.test(href)){trail=href.slice(-1)+trail;href=href.slice(0,-1);}
    return `<a class="notice-auto-link" href="${href}" target="_blank" rel="noopener noreferrer">${href}</a>${trail}`;
  });
  return linked.replace(/\n/g,'<br>');
}

export function initNoticeLinksStyle(){
  if(document.getElementById('moduleNoticeLinksStyle'))return;
  const st=document.createElement('style');
  st.id='moduleNoticeLinksStyle';
  st.textContent=`
    .portal-board-body .notice-auto-link,#homeNoticePopupBody .notice-auto-link{color:#0b57d0;text-decoration:underline;text-underline-offset:2px;word-break:break-all;font-weight:800}
    .portal-board-body .notice-auto-link:visited,#homeNoticePopupBody .notice-auto-link:visited{color:#5b21b6}
  `;
  document.head.appendChild(st);
}
