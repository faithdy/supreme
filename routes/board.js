/**
 * Created by kuvshinov on 16. 8. 4.
 */
const express = require('express');
const router = express.Router();
const session = require('express-session');

const fs = require('fs');
const path = require('path');
const bodyparser = require('body-parser');
const multer = require('multer');
const Sugar = require('sugar');
const mkdirp = require('mkdirp');
const shelljs = require('shelljs');

const db = require('../model/db');
require('../model/boardmodel');
const BoardModel = db.model('Board');
const UserModel = db.model('User');
const UploadModel = db.model('Upload');


router.use(session({
    secret: 'bimil',
    resave: false,
    saveUninitialized: true
}));

router.use(bodyparser.urlencoded({extended: false}));

router.get('/', function(req, res) {
    // res.render('board', { title: '게시판' });
    res.redirect('/board/list');
});
;
router.get('/member', function (req, res, next) {
    if(req.session.perm) {
        UserModel.find({}, function (e, result) {
            var datas = {
                "title" : "회원 목록",
                "data" : result,
                "sess" : req.session
            };

            res.render('member', datas);
        });
    }
    else{
        res.send('<script>alert("권한이 없습니다."); location.href="/board/list"</script>');
    }
});

router.get('/download/:idx', function (req, res, next) {
    console.log(req.session);
    if(!req.session.username)
        res.send('<script>alert("로그인이 필요합니다."); location.href="/board/list"</script>');
    else {
        BoardModel.findOne({idx: req.params.idx}, function (e, result) {
            if (e) {
                console.error('err', e);
                return handleError(e);
            }

            if (result != null) {
                var downloadPath = __dirname + '/../../Auto_Scoring_System/info/' + result.title + '/' + result.attachment;

                if (downloadPath != '') {
                    res.download(downloadPath);
                } else {
                    res.redirect('/board/list');
                }
            } else {
                console.log("글이 없어양");
                res.redirect('/board/list');
            }
        });
    }
});

router.post('/upload/:idx/:title', function (req, res, next) {
    console.log(req.session);
    console.log(req.params.idx);

    const uploader = req.session.hakbun;

    if(req.session.perm){   // 조교가 업로드했을 때.
        var uploadPath = __dirname + '/../../Auto_Scoring_System/info/' + req.params.title + '/';
        var filename = '';

        mkdirp.sync(uploadPath);

        var storage = multer.diskStorage({
            destination: function (req, file, cb) {
                cb(null, uploadPath);
            },
            filename: function (req, file, cb) {
                filename = file.originalname;
                cb(null, file.originalname);
            }
        });

        var upload = multer({storage: storage}).single('attachment');

        upload(req, res, function (e) {
            if (e) {
                console.error('err', e);
                return handleError(e);
            } else {
                console.log("업로드 완료");

                BoardModel.update({idx: req.params.idx}, {$set:{attachment:filename}}, function (e, result) {
                    if (e) {
                        console.error('err', e);
                        return handleError(e);
                    }
                });
            }
        });
    }
    else if (!req.session.perm){    // Student upload
        var uploadPath = __dirname + '/../../Auto_Scoring_System/Assignment/' + req.params.title + '/' + uploader + '/';

        mkdirp.sync(uploadPath + '/Result');

        var storage = multer.diskStorage({
            destination: function (req, file, cb) {
                cb(null, uploadPath);
            },
            filename: function (req, file, cb) {
                cb(null, uploader + ".tar.gz");
            }
        });

        var upload = multer({storage: storage}).single('attachment');

        upload(req, res, function (e) {
            if (e) {
                console.error('err', e);
                return handleError(e);
            } else {
                console.log("업로드 완료");

                BoardModel.findOne({idx: req.params.idx}, function (e, result) {
                    if (e) {
                        console.error('err', e);
                        return handleError(e);
                    }

                    if (result != null) {
                        UploadModel.findOne({uploader: uploader}, function (e, isUploaded) {
                            shelljs.exec('/usr/local/Auto_Scoring_System/src/ASS.sh' + " " + result.title + " " + result.unittest + " " + uploader, function (code, stdout, stderr) {
                                console.log("Exit code : ", code);
                                console.log("Output : ", stdout);
                                console.log("StdErr : ", stderr);
                            });

                            if(isUploaded == null) {
                                var newUpload = new UploadModel({
                                    idx: req.params.idx,
                                    uploader: uploader,
                                    regdate: Sugar.Date.format(new Date(), "%Y.%m.%d-%H:%M:%S")
                                });
                                newUpload.save(function (e, data) {
                                    if (e) {
                                        console.error('err', e);
                                        return handleError(e);
                                    }
                                    console.log("과제 업로드 결과 디비 저장");
                                });
                            }else{
                                UploadModel.update(
                                    {uploader: uploader},
                                    {$set: {regdate: Sugar.Date.format(new Date(), "%Y.%m.%d-%H:%M:%S")}},
                                    function (e, result) {
                                        if(e){
                                            console.error('err', e);
                                            return handleError(e);
                                        }
                                    });
                            }
                        });
                    } else {
                        console.log("글이 없어양");
                    }
                });
            }
        });
    }

    res.redirect('/board/list');
});

router.post('/signup', function (req, res, next) {
    console.log(req.body);

    UserModel.findOne({ id: req.body.user_id }, function (e, user) {
        if (e) {
            console.error('err', e);
            return handleError(e);
        }

        if (user == null) {
            var newUser = new UserModel({
                id: req.body.user_id,
                pw: req.body.user_pw,
                email: req.body.user_email,
                name: req.body.user_name,
                hakbun: req.body.user_hakbun,
                perm: false
            });
            newUser.save(function (e, data) {
                if (e) {
                    console.error('err', e);
                    return handleError(e);
                }
            });
            console.log('가입 성공');
        }
    });

    console.log(req.session);
    res.redirect('/board/list');
});

router.post('/login', function (req, res, next) {
    console.log(req.body);

    UserModel.findOne({ id: req.body.user_id, pw: req.body.user_pw }, function (e, user) {
        if (e) {
            console.error('err', e);
            return handleError(e);
        }

        if (user != null){
            req.session.username  = user.id;
            req.session.hakbun = user.hakbun;
            req.session.name = user.name;
            req.session.perm = user.perm;

            res.redirect('/board/list');
        }
        else{
            console.log("로그인 실패");
            res.send('<script>alert("아이디 또는 비밀번호가 일치하지 않습니다."); location.href="/board/list"</script>');
        }
    });
});

router.post('/check', function (req, res, next) {
    UserModel.find({$or:[ {id: req.body.user_id}, {hakbun: req.body.user_hakbun}]}, function (e, user) {
        if (user.length == 0) {
            console.log("안 중복");
            res.send("true");
        }
        else {
            console.log("중복");
            res.send("false");
        }
    });
});

router.get('/')

router.get('/logout', function (req, res, next) {
    console.log("접속중인 아이디 : " + req.session.username);
    if(req.session){
        req.session.destroy(function (e) {
            if(e)
                console.error('err', e);
        });
    }
    res.redirect('/board/list');
});

router.get('/write', function(req, res, next) {
    if ( req.session.perm )
        res.render('write', {title: "셋업", sess: req.session});
    else if ( !req.session.perm )
        res.send('<script>alert("권한이 없습니다."); location.href="/board/list/1"</script>');
    else
        res.send('<script>alert("로그인이 필요합니다."); location.href="/board/list/1"</script>');
});

router.post('/write', function (req, res, next) {
    console.log(req.body);
    console.log(req.session);
/*
    var filename = __dirname + "/../public/uploads/" + "reqbody.json";

    fs.writeFile(filename, JSON.stringify(req.body), 'utf8', function (e) {
        // res.json({success: true});
        if(e)
            console.log(e);
        else
            console.log(filename + " 파일 쓰기 성공");
    });
*/

    // DB model create & save.
    var board = new BoardModel({
        title: req.body.title,
        unittest: req.body.unittest,
        subject: req.body.subject,
        date: req.body.date,
        content: req.body.content,
        writer: req.session.name,
        submit_form: req.body.submit_form,
        attachment: ""
    });

    board.save(function (err, doc) {
        if(err)
            console.error('err', err);
        // res.json(doc);
        // res.redirect('/board/list');
    });

    res.redirect('/board/list');
});

router.get('/list', function (req, res, next) {
    res.redirect('/board/list/1');
})

router.get('/list/:page', function (req, res, next) {
    var page = req.params.page;

    page = parseInt(page, 10);

    BoardModel.count(function (err, cnt) {
        var size = 10;  // 한 페이지에 보여줄 개수
        var begin = (page - 1) * size; // 시작 글
        var totalPage = Math.ceil(cnt / size);  // 전체 페이지의 수 (75 / 10 = 7.5(X) -> 8(O))
        var pageSize = 10; // 페이지 링크의 개수

        // 1~10페이지는 1로, 11~20페이지는 11로 시작되어야하기 때문에 숫자 첫째자리의 수를 고정시키기 위한 계산법
        var startPage = Math.floor((page-1) / pageSize) * pageSize + 1;
        var endPage = startPage + (pageSize - 1);

        if(endPage > totalPage) {
            endPage = totalPage;
        }

        // 전체 글이 존재하는 개수
        var max = cnt - ((page-1) * size);
        BoardModel.find({}).sort("-idx").skip(begin).limit(size).exec(function (err, docs) {
            if (err) console.error('err', err);
            // console.log((docs));
            for(i in docs){
                if(docs[i].content.length>200){
                    docs[i].content = docs[i].content.substr(0,200)+"...";
                }
            }
            //res.json({"result" : docs});

            var datas = {
                "login" : req.session.username,
                "title" : "과제 목록",
                "data" : docs,
                "page" : page,
                "pageSize" : pageSize,
                "startPage" : startPage,
                "endPage" : endPage,
                "totalPage" : totalPage,
                "max" : max,
                "sess" : req.session
            };

            res.render('list', datas);
        });
    });
});

router.post('/assignment', function (req, res, next) {
    const uploader = req.session.hakbun;

    console.log(uploader);
    console.log(req.session);

    UploadModel.findOne({uploader: uploader}, function (err, result) {
        console.log(result);
        res.json(result);
    })
});

router.get('/assignment/:idx', function (req, res, next) {
    if(!req.session.username){
        res.send('<script>alert("로그인이 필요합니다."); location.href="/board/list"</script>');
    }else if(req.session.perm){
        var idx = req.params.idx;

        UploadModel.find({idx: idx}, function (err, result) {
            if(err){
                console.error('err', err);
                return handleError(err);
            }

            var datas = {"title": "과제 점수 관리", "data": result, "sess": req.session, "idx": idx};

            console.log(result);

            res.render('assignment', datas);
        });
    }
});

router.get('/read/:idx', function (req, res, next) {
    const uploader = req.session.hakbun;

    if(!req.session.username)
        res.send('<script>alert("로그인이 필요합니다."); location.href="/board/list"</script>');
        // res.redirect('/board/list');
    else {
        var idx = req.params.idx;

        BoardModel.findOne({"idx": idx}, function (err, docs) {
            if (err){
                console.error('err', err);
                return handleError(err);
            }

            shelljs.exec('python /usr/local/Auto_Scoring_System/src/DB_Scoring.py' + " " + docs.title + " " + uploader, function (code, stdout, stderr){
                console.log("Exit code : ", code);
                console.log("Output : ", stdout);
                console.log("StdErr : ", stderr);

                UploadModel.findOne({'idx': idx, 'uploader':uploader}, function (e, result) {
                    var datas = {"title": "글 읽기", "data": docs, "sess": req.session, "idx": idx, 'submit': '', 'result': result};
                    if(result != null) {
                        datas['submit'] = true;
                        console.log('제출');
                    } else {
                        datas['submit'] = false;
                        console.log('미제출');
                    }

                    res.render('read', datas);
                });
            });
        });
    }
});

// 글 300개 임의 작성
router.get('/write300', function (req, res, next) {
   for(var i = 1; i < 300; i++){
       var board = new BoardModel({
            "subject": i + '차 과제 안내',
            "content": i + '차 과제 안내입니다.',
            "submit_form": 'tar.gz',
            'date': Date.now(),
            'writer': '나',
            'attachment': ''
       });

       board.save(function (err, doc) {
           if(err)
               console.error('err', err);
       });
   }

   res.send('<script>alert("success"); location.href="/board/list/1"</script>');
});

module.exports = router;
