document.addEventListener('DOMContentLoaded',()=>SellerProfile.init());
const SellerProfile={
 key:'desimall_seller_session',session:null,files:{avatar:null,logo:null,banner:null},kycFiles:{aadhaar:null,pan:null,gst:null,bank:null},
 read(){try{return JSON.parse(localStorage.getItem(this.key))||{};}catch(_){return{};}},
 async init(){
  this.session=this.read();if(!this.session.token){location.replace('login.html');return;}
  let r;try{r=await DesiMallAPI.sellerSession(this.session.token);}catch(_){r={success:false,message:'Network unavailable'};}
  if(!r.success){const m=String(r.message||r.error||'').toLowerCase();if(/invalid|expired|unauthor|login again|session not found|token/.test(m)){localStorage.removeItem(this.key);location.replace('login.html?reason=session');return;}if(!this.session.seller){this.msg(r.message||'Session verify nahi ho paayi.');return;}}
  else{this.session.seller=r.seller||this.session.seller;localStorage.setItem(this.key,JSON.stringify(this.session));}
  this.fill(this.session.seller||{});this.fillKyc(this.session.seller||{});
  sellerProfileForm.onsubmit=e=>{e.preventDefault();this.save();};
  sellerKycForm.onsubmit=e=>{e.preventDefault();this.submitKyc();};
  sellerAvatarFile.onchange=e=>this.select('avatar',e.target.files[0]);
  shopLogoFile.onchange=e=>this.select('logo',e.target.files[0]);
  shopBannerFile.onchange=e=>this.select('banner',e.target.files[0]);
  aadhaarDoc.onchange=e=>this.selectKyc('aadhaar',e.target.files[0]);panDoc.onchange=e=>this.selectKyc('pan',e.target.files[0]);gstDoc.onchange=e=>this.selectKyc('gst',e.target.files[0]);bankDoc.onchange=e=>this.selectKyc('bank',e.target.files[0]);
  sellerShopName.oninput=()=>shopPreviewName.textContent=sellerShopName.value||'Your Shop';sellerOwnerName.oninput=()=>shopPreviewOwner.textContent=sellerOwnerName.value||'Seller profile';
  sellerLogout.onclick=()=>{localStorage.removeItem(this.key);location.replace('login.html');};
 },
 fill(s){sellerShopName.value=s.ShopName||'';sellerOwnerName.value=s.SellerName||'';sellerMobile.value=s.Mobile||'';sellerEmail.value=s.Email||'';sellerAddress.value=s.Address||'';this.showAvatar(s.ProfileImage||'',s.SellerName||s.ShopName);this.showLogo(s.ShopLogo||'');this.showBanner(s.ShopBanner||'');shopPreviewName.textContent=s.ShopName||'Your Shop';shopPreviewOwner.textContent=s.SellerName||'Seller profile';},
 fillKyc(s){
  kycBusinessType.value=s.BusinessType||'';kycGSTIN.value=s.GSTIN||'';kycPAN.value=s.PAN||'';kycAadhaar.value=s.Aadhaar||'';kycBankName.value=s.BankName||'';kycAccountNumber.value=s.AccountNumber||'';kycIFSC.value=s.IFSC||'';kycUPI.value=s.UPIID||'';
  const status=s.KYCStatus||'Not Submitted';sellerKycStatus.textContent=status;sellerKycStatus.className='kyc-status-badge '+String(status).toLowerCase().replace(/\s+/g,'-');
  sellerKycNote.textContent=s.KYCNotes||'No review note.';sellerKycDates.textContent=[s.KYCSubmittedAt?`Submitted: ${this.date(s.KYCSubmittedAt)}`:'',s.KYCReviewedAt?`Reviewed: ${this.date(s.KYCReviewedAt)}`:''].filter(Boolean).join(' • ');
  this.link('aadhaar',s.AadhaarDocumentURL);this.link('pan',s.PANDocumentURL);this.link('gst',s.GSTDocumentURL);this.link('bank',s.BankDocumentURL);
  const active=String(s.Status||'').toLowerCase()==='active',approved=String(status).toLowerCase()==='approved';
  kycAccessNotice.textContent=approved&&active?'KYC approved. Your seller account has full selling access.':String(status).toLowerCase()==='rejected'?'KYC rejected. Correct the details/documents and submit again.':'Complete KYC and wait for admin approval. Product and order operations stay locked until approval.';
  kycAccessNotice.className='kyc-notice '+(approved&&active?'good':String(status).toLowerCase()==='rejected'?'bad':'');
 },
 link(type,url){const el=document.getElementById(type+'DocLink');if(url){el.href=url;el.classList.remove('hidden')}else el.classList.add('hidden');},
 date(v){const d=new Date(v);return isNaN(d)?String(v):d.toLocaleString('en-IN');},
 initials(n){return String(n||'S').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();},
 showAvatar(src,name){sellerAvatarPreview.innerHTML=src?`<img src="${src}" alt="Profile picture">`:`<span>${this.initials(name)}</span>`;},showLogo(src){shopLogoPreview.innerHTML=src?`<img src="${src}" alt="Shop logo">`:'<i class="fa-solid fa-store"></i>';},showBanner(src){shopBannerPreview.innerHTML=src?`<img src="${src}" alt="Shop banner">`:'<div class="banner-placeholder"><i class="fa-regular fa-image"></i><span>Shop banner</span></div>';},
 select(type,file){if(!file)return;if(!/^image\/(jpeg|png|webp)$/.test(file.type))return this.msg('Only JPG, PNG or WEBP allowed.');if(file.size>8*1024*1024)return this.msg('Image must be under 8 MB.');this.files[type]=file;const r=new FileReader();r.onload=()=>{if(type==='avatar')this.showAvatar(r.result,sellerOwnerName.value);if(type==='logo')this.showLogo(r.result);if(type==='banner')this.showBanner(r.result);};r.readAsDataURL(file);},
 selectKyc(type,file){if(!file)return;if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type))return this.kycMsg('Only JPG, PNG, WEBP or PDF allowed.');if(file.size>8*1024*1024)return this.kycMsg('Document must be under 8 MB.');this.kycFiles[type]=file;this.kycMsg(`${type.toUpperCase()} document selected.` ,true);},
 async fileData(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(file);});},
 async upload(file,type){if(!file)return null;const payload={Token:this.session.token,FileName:file.name,MimeType:file.type,Base64Data:await this.fileData(file)};return type==='avatar'?DesiMallAPI.uploadSellerAvatar(payload):DesiMallAPI.uploadSellerBrandAsset({...payload,AssetType:type});},
 async uploadKyc(file,type){if(!file)return null;return DesiMallAPI.uploadSellerKYCDocument({Token:this.session.token,DocumentType:type,FileName:file.name,MimeType:file.type,Base64Data:await this.fileData(file)});},
 async save(){
  const btn=saveSellerProfile;btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Saving...';const s=this.session.seller||{};let avatar=s.ProfileImage||'',avatarId=s.ProfileImageFileID||'',logo=s.ShopLogo||'',logoId=s.ShopLogoFileID||'',banner=s.ShopBanner||'',bannerId=s.ShopBannerFileID||'';
  try{for(const type of ['avatar','logo','banner']){if(!this.files[type])continue;const up=await this.upload(this.files[type],type);if(!up||!up.success)throw new Error((up&&up.message)||`${type} upload failed.`);if(type==='avatar'){avatar=up.imageUrl;avatarId=up.fileId}if(type==='logo'){logo=up.imageUrl;logoId=up.fileId}if(type==='banner'){banner=up.imageUrl;bannerId=up.fileId}}
   const r=await DesiMallAPI.updateSellerProfile({Token:this.session.token,ShopName:sellerShopName.value.trim(),SellerName:sellerOwnerName.value.trim(),Email:sellerEmail.value.trim(),Address:sellerAddress.value.trim(),ProfileImage:avatar,ProfileImageFileID:avatarId,ShopLogo:logo,ShopLogoFileID:logoId,ShopBanner:banner,ShopBannerFileID:bannerId});if(!r.success)throw new Error(r.message||'Profile update failed.');this.session.seller=r.seller;localStorage.setItem(this.key,JSON.stringify(this.session));this.fill(r.seller);this.files={avatar:null,logo:null,banner:null};this.msg('Profile and branding updated.',true);SellerShell.apply(r.seller);
  }catch(err){this.msg(err.message||'Save failed.')}btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-floppy-disk"></i> Save profile & branding';
 },
 async submitKyc(){
  const btn=submitSellerKyc;btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Uploading & submitting...';const s=this.session.seller||{}, docs={aadhaar:{url:s.AadhaarDocumentURL||'',id:s.AadhaarDocumentFileID||''},pan:{url:s.PANDocumentURL||'',id:s.PANDocumentFileID||''},gst:{url:s.GSTDocumentURL||'',id:s.GSTDocumentFileID||''},bank:{url:s.BankDocumentURL||'',id:s.BankDocumentFileID||''}};
  try{
   for(const type of ['aadhaar','pan','gst','bank']){if(!this.kycFiles[type])continue;const up=await this.uploadKyc(this.kycFiles[type],type);if(!up.success)throw new Error(up.message||`${type} upload failed.`);docs[type]={url:up.fileUrl,id:up.fileId};}
   const r=await DesiMallAPI.submitSellerKYC({Token:this.session.token,BusinessType:kycBusinessType.value,GSTIN:kycGSTIN.value.trim(),PAN:kycPAN.value.trim(),Aadhaar:kycAadhaar.value.trim(),BankName:kycBankName.value.trim(),AccountNumber:kycAccountNumber.value.trim(),IFSC:kycIFSC.value.trim(),UPIID:kycUPI.value.trim(),AadhaarDocumentURL:docs.aadhaar.url,AadhaarDocumentFileID:docs.aadhaar.id,PANDocumentURL:docs.pan.url,PANDocumentFileID:docs.pan.id,GSTDocumentURL:docs.gst.url,GSTDocumentFileID:docs.gst.id,BankDocumentURL:docs.bank.url,BankDocumentFileID:docs.bank.id});
   if(!r.success)throw new Error(r.message||'KYC submission failed.');this.session.seller=r.seller;localStorage.setItem(this.key,JSON.stringify(this.session));this.fillKyc(r.seller);this.kycFiles={aadhaar:null,pan:null,gst:null,bank:null};sellerKycForm.querySelectorAll('input[type=file]').forEach(x=>x.value='');this.kycMsg(r.message,true);
  }catch(err){this.kycMsg(err.message||'KYC submission failed.')}btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-paper-plane"></i> Submit KYC for Review';
 },
 msg(t,good=false){sellerProfileMessage.textContent=t;sellerProfileMessage.classList.toggle('good',good);},kycMsg(t,good=false){sellerKycMessage.textContent=t;sellerKycMessage.classList.toggle('good',good);}
};