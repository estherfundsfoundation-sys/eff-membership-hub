/* Safe public connection only. Never place a Supabase secret key in this file. */
window.EFF_MEMBER_SUPABASE={url:"https://scqrxrhwicammsfrmqck.supabase.co",publishableKey:"sb_publishable_eyAsdkd7nKm9gBoyX0gRcA_E-6NE6LN"};

document.addEventListener('DOMContentLoaded',function(){
  var message=document.getElementById('loginMessage');
  if(!message)return;
  var note=document.createElement('p');
  note.className='small';
  note.innerHTML='<strong>Important:</strong> Your secure sign-in email may arrive in Spam, Junk, or Promotions. Please check there before requesting another link.';
  message.insertAdjacentElement('afterend',note);
  var school=document.getElementById('school');
  if(school){
    var path=document.createElement('label');
    path.innerHTML='Your pathway<select id="memberPath"><option value="member">Current / prospective EFF member</option><option value="alumni">EFF alumni</option><option value="community">Community member / supporter</option></select>';
    school.closest('label').insertAdjacentElement('beforebegin',path);
  }
});
