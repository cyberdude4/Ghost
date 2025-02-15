const should = require('should');
const sinon = require('sinon');
const moment = require('moment');
const supertest = require('supertest');
const _ = require('lodash');
const labs = require('../../../../../server/services/labs');
const testUtils = require('../../../../utils');
const localUtils = require('./utils');
const configUtils = require('../../../../utils/configUtils');
const urlUtils = require('../../../../utils/urlUtils');
const config = require('../../../../../server/config');

const ghost = testUtils.startGhost;
let request;

describe('api/canary/content/posts', function () {
    before(function () {
        return ghost()
            .then(function () {
                request = supertest.agent(config.get('url'));
            })
            .then(function () {
                return testUtils.initFixtures('users:no-owner', 'user:inactive', 'posts', 'tags:extra', 'api_keys');
            });
    });

    afterEach(function () {
        configUtils.restore();
        urlUtils.restore();
    });

    const validKey = localUtils.getValidKey();

    it('browse posts', function (done) {
        request.get(localUtils.API.getApiQuery(`posts/?key=${validKey}`))
            .set('Origin', testUtils.API.getURL())
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(200)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }

                res.headers.vary.should.eql('Accept-Encoding');
                should.exist(res.headers['access-control-allow-origin']);
                should.not.exist(res.headers['x-cache-invalidate']);

                var jsonResponse = res.body;
                should.exist(jsonResponse.posts);
                localUtils.API.checkResponse(jsonResponse, 'posts');
                jsonResponse.posts.should.have.length(11);
                localUtils.API.checkResponse(jsonResponse.posts[0], 'post');
                localUtils.API.checkResponse(jsonResponse.meta.pagination, 'pagination');
                _.isBoolean(jsonResponse.posts[0].featured).should.eql(true);

                // Default order 'published_at desc' check
                jsonResponse.posts[0].slug.should.eql('welcome');
                jsonResponse.posts[6].slug.should.eql('themes');

                // check meta response for this test
                jsonResponse.meta.pagination.page.should.eql(1);
                jsonResponse.meta.pagination.limit.should.eql(15);
                jsonResponse.meta.pagination.pages.should.eql(1);
                jsonResponse.meta.pagination.total.should.eql(11);
                jsonResponse.meta.pagination.hasOwnProperty('next').should.be.true();
                jsonResponse.meta.pagination.hasOwnProperty('prev').should.be.true();
                should.not.exist(jsonResponse.meta.pagination.next);
                should.not.exist(jsonResponse.meta.pagination.prev);

                done();
            });
    });

    it('browse posts with related authors/tags also returns primary_author/primary_tag', function (done) {
        request.get(localUtils.API.getApiQuery(`posts/?key=${validKey}&include=authors,tags`))
            .set('Origin', testUtils.API.getURL())
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(200)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }

                res.headers.vary.should.eql('Accept-Encoding');
                should.exist(res.headers['access-control-allow-origin']);
                should.not.exist(res.headers['x-cache-invalidate']);

                var jsonResponse = res.body;
                should.exist(jsonResponse.posts);
                localUtils.API.checkResponse(jsonResponse, 'posts');
                jsonResponse.posts.should.have.length(11);
                localUtils.API.checkResponse(
                    jsonResponse.posts[0],
                    'post',
                    ['authors', 'tags', 'primary_tag', 'primary_author'],
                    null
                );

                localUtils.API.checkResponse(jsonResponse.meta.pagination, 'pagination');
                _.isBoolean(jsonResponse.posts[0].featured).should.eql(true);

                // Default order 'published_at desc' check
                jsonResponse.posts[0].slug.should.eql('welcome');
                jsonResponse.posts[6].slug.should.eql('themes');

                // check meta response for this test
                jsonResponse.meta.pagination.page.should.eql(1);
                jsonResponse.meta.pagination.limit.should.eql(15);
                jsonResponse.meta.pagination.pages.should.eql(1);
                jsonResponse.meta.pagination.total.should.eql(11);
                jsonResponse.meta.pagination.hasOwnProperty('next').should.be.true();
                jsonResponse.meta.pagination.hasOwnProperty('prev').should.be.true();
                should.not.exist(jsonResponse.meta.pagination.next);
                should.not.exist(jsonResponse.meta.pagination.prev);

                done();
            });
    });

    it('browse posts with basic page filter should not return pages', function (done) {
        request.get(localUtils.API.getApiQuery(`posts/?key=${validKey}&filter=page:true`))
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(200)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }
                const jsonResponse = res.body;

                should.not.exist(res.headers['x-cache-invalidate']);
                should.exist(jsonResponse.posts);
                localUtils.API.checkResponse(jsonResponse, 'posts');
                localUtils.API.checkResponse(jsonResponse.meta.pagination, 'pagination');
                jsonResponse.posts.should.have.length(0);

                done();
            });
    });

    it('browse posts with basic page filter should not return pages', function (done) {
        request.get(localUtils.API.getApiQuery(`posts/?key=${validKey}&filter=page:true,featured:true`))
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(200)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }
                const jsonResponse = res.body;

                should.not.exist(res.headers['x-cache-invalidate']);
                should.exist(jsonResponse.posts);
                localUtils.API.checkResponse(jsonResponse, 'posts');
                localUtils.API.checkResponse(jsonResponse.meta.pagination, 'pagination');
                jsonResponse.posts.should.have.length(2);
                jsonResponse.posts.filter(p => (p.page === true)).should.have.length(0);

                done();
            });
    });

    it('browse posts with published and draft status, should not return drafts', function (done) {
        request.get(localUtils.API.getApiQuery(`posts/?key=${validKey}&filter=status:published,status:draft`))
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(200)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }
                const jsonResponse = res.body;

                jsonResponse.posts.should.be.an.Array().with.lengthOf(11);

                done();
            });
    });

    it('ensure origin header on redirect is not getting lost', function (done) {
        // NOTE: force a redirect to the admin url
        configUtils.set('admin:url', 'http://localhost:9999');
        urlUtils.stubUrlUtilsFromConfig();

        request.get(localUtils.API.getApiQuery(`posts?key=${validKey}`))
            .set('Origin', 'https://example.com')
            // 301 Redirects _should_ be cached
            .expect('Cache-Control', testUtils.cacheRules.year)
            .expect(301)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }

                res.headers.vary.should.eql('Accept, Accept-Encoding');
                res.headers.location.should.eql(`http://localhost:9999/ghost/api/canary/content/posts/?key=${validKey}`);
                should.exist(res.headers['access-control-allow-origin']);
                should.not.exist(res.headers['x-cache-invalidate']);
                done();
            });
    });

    it('can\'t read page', function () {
        return request
            .get(localUtils.API.getApiQuery(`posts/${testUtils.DataGenerator.Content.posts[5].id}/?key=${validKey}`))
            .set('Origin', testUtils.API.getURL())
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(404);
    });

    it('can read post with fields', function () {
        return request
            .get(localUtils.API.getApiQuery(`posts/${testUtils.DataGenerator.Content.posts[0].id}/?key=${validKey}&fields=title,slug`))
            .set('Origin', testUtils.API.getURL())
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(200)
            .then((res) => {
                localUtils.API.checkResponse(res.body.posts[0], 'post', null, null, ['id', 'title', 'slug']);
            });
    });

    describe('content gating', function () {
        let membersPost;
        let paidPost;

        before(function () {
            // NOTE: ideally this would be set through Admin API request not a stub
            sinon.stub(labs, 'isSet').withArgs('members').returns(true);
        });

        before (function () {
            membersPost = testUtils.DataGenerator.forKnex.createPost({
                slug: 'thou-shalt-not-be-seen',
                visibility: 'members',
                published_at: moment().add(45, 'seconds').toDate() // here to ensure sorting is not modified
            });

            paidPost = testUtils.DataGenerator.forKnex.createPost({
                slug: 'thou-shalt-be-paid-for',
                visibility: 'paid',
                published_at: moment().add(30, 'seconds').toDate() // here to ensure sorting is not modified
            });

            return testUtils.fixtures.insertPosts([
                membersPost,
                paidPost
            ]);
        });

        it('cannot read members only post content', function () {
            return request
                .get(localUtils.API.getApiQuery(`posts/${membersPost.id}/?key=${validKey}`))
                .set('Origin', testUtils.API.getURL())
                .expect('Content-Type', /json/)
                .expect('Cache-Control', testUtils.cacheRules.private)
                .expect(200)
                .then((res) => {
                    const jsonResponse = res.body;
                    should.exist(jsonResponse.posts);
                    const post = jsonResponse.posts[0];

                    localUtils.API.checkResponse(post, 'post', null, null);
                    post.slug.should.eql('thou-shalt-not-be-seen');
                    post.html.should.eql('');
                });
        });

        it('cannot read paid only post content', function () {
            return request
                .get(localUtils.API.getApiQuery(`posts/${paidPost.id}/?key=${validKey}`))
                .set('Origin', testUtils.API.getURL())
                .expect('Content-Type', /json/)
                .expect('Cache-Control', testUtils.cacheRules.private)
                .expect(200)
                .then((res) => {
                    const jsonResponse = res.body;
                    should.exist(jsonResponse.posts);
                    const post = jsonResponse.posts[0];

                    localUtils.API.checkResponse(post, 'post', null, null);
                    post.slug.should.eql('thou-shalt-be-paid-for');
                    post.html.should.eql('');
                });
        });

        it('cannot read members only post plaintext', function () {
            return request
                .get(localUtils.API.getApiQuery(`posts/${membersPost.id}/?key=${validKey}&formats=html,plaintext&fields=html,plaintext`))
                .set('Origin', testUtils.API.getURL())
                .expect('Content-Type', /json/)
                .expect('Cache-Control', testUtils.cacheRules.private)
                .expect(200)
                .then((res) => {
                    const jsonResponse = res.body;
                    should.exist(jsonResponse.posts);
                    const post = jsonResponse.posts[0];

                    localUtils.API.checkResponse(post, 'post', null, null, ['id', 'html', 'plaintext']);
                    post.html.should.eql('');
                    post.plaintext.should.eql('');
                });
        });

        it('cannot browse members only posts content', function () {
            return request.get(localUtils.API.getApiQuery(`posts/?key=${validKey}`))
                .set('Origin', testUtils.API.getURL())
                .expect('Content-Type', /json/)
                .expect('Cache-Control', testUtils.cacheRules.private)
                .expect(200)
                .then((res) => {
                    res.headers.vary.should.eql('Accept-Encoding');
                    should.exist(res.headers['access-control-allow-origin']);
                    should.not.exist(res.headers['x-cache-invalidate']);

                    const jsonResponse = res.body;
                    should.exist(jsonResponse.posts);
                    localUtils.API.checkResponse(jsonResponse, 'posts');
                    jsonResponse.posts.should.have.length(13);
                    localUtils.API.checkResponse(jsonResponse.posts[0], 'post');
                    localUtils.API.checkResponse(jsonResponse.meta.pagination, 'pagination');
                    _.isBoolean(jsonResponse.posts[0].featured).should.eql(true);

                    // Default order 'published_at desc' check
                    jsonResponse.posts[0].slug.should.eql('thou-shalt-not-be-seen');
                    jsonResponse.posts[1].slug.should.eql('thou-shalt-be-paid-for');
                    jsonResponse.posts[6].slug.should.eql('organising-content');

                    jsonResponse.posts[0].html.should.eql('');
                    jsonResponse.posts[1].html.should.eql('');
                    jsonResponse.posts[6].html.should.not.eql('');

                    // check meta response for this test
                    jsonResponse.meta.pagination.page.should.eql(1);
                    jsonResponse.meta.pagination.limit.should.eql(15);
                    jsonResponse.meta.pagination.pages.should.eql(1);
                    jsonResponse.meta.pagination.total.should.eql(13);
                    jsonResponse.meta.pagination.hasOwnProperty('next').should.be.true();
                    jsonResponse.meta.pagination.hasOwnProperty('prev').should.be.true();
                    should.not.exist(jsonResponse.meta.pagination.next);
                    should.not.exist(jsonResponse.meta.pagination.prev);
                });
        });
    });
});
