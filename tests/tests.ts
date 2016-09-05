import test_chunker from "./test_chunker.spec";
import test_chunk from "./test_chunk.spec";
import test_unchunker from "./test_unchunker.spec";

var counter = 1;
beforeEach(() => console.info('------ TEST', counter++, 'BEGIN ------'));

test_chunker();
test_chunk();
test_unchunker();